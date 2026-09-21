"""Completa el plan de estudio leyendo las RESOLUCIONES/ANEXO de la DGE.

Las resoluciones traen el plan embebido en texto (no escaneado): una tabla
"Distribución de espacios curriculares por año" y/o descriptores por unidad.
Este script las descarga de la biblioteca de medios del IES, extrae el plan y
lo mapea a la carrera por el título interno del PDF + nombre de archivo.

No inventa: si el PDF no tiene texto o no se puede mapear, queda pendiente.

Uso:
    python3 scrapers/planes_resolucion.py [--dry] [archivo.json ...]
"""

import json
import re
import sys

import requests

from pdf_utils import _texto_pdf, plan_desde_resolucion
from planes_pdf import (
    SITIOS,
    base_carrera,
    clave_desde_archivo,
    listar_pdfs_plan,
    norm,
    plan_creible,
    score,
    titulo_del_pdf,
)
from scraper_utils import DIR_DATOS, guardar_json

H = {"User-Agent": "Mozilla/5.0"}

# IES cuyos planes viven dentro de resoluciones/anexos de la DGE.
OBJETIVOS = ["ies9024.json", "ies9026.json", "ies9029.json", "ies9023.json"]


_PATRONES_CARRERA = [
    re.compile(r"Nombre de la carrera\s*:?\s*([\s\S]{5,120})", re.I),
    re.compile(r"[Cc]arrera\s+(?:de\s+)?[\u201c\"]([^\u201d\"]{5,90})[\u201d\"]"),
    re.compile(r"Plan de Estudios?\s*[\u201c\"]([^\u201d\"]{5,90})[\u201d\"]"),
    re.compile(r"de la carrera de\s+([A-Z\u00c1\u00c9\u00cd\u00d3\u00da][^\"\n.]{4,90})"),
    re.compile(r"carrera\s*[\u201c\"]([^\u201d\"]{5,90})[\u201d\"]"),
]


def carrera_en_resolucion(texto):
    """Nombre de la carrera tal como lo declara la resolución."""
    for patron in _PATRONES_CARRERA:
        m = patron.search(texto)
        if not m:
            continue
        nombre = re.split(r"\n", m.group(1))[0]
        nombre = re.sub(r"\s+", " ", nombre).strip(" .,;:-\u201c\u201d\"")
        if 5 <= len(nombre) <= 95:
            return nombre
    return ""


def texto_titulo(texto):
    """Etiqueta para mapear el PDF a una carrera."""
    declarado = carrera_en_resolucion(texto)
    referencia = re.search(r"Referencia:?\s*(.{0,120})", texto, re.S)
    partes = [declarado]
    if not declarado and referencia:
        partes.append(referencia.group(1))
    return norm(" ".join(partes))


def procesar(json_nombre, dry=False):
    base = SITIOS.get(json_nombre)
    if not base:
        return None
    datos = json.load(open(DIR_DATOS / json_nombre, encoding="utf-8"))
    carreras = [c for inst in datos.get("instituciones", []) for c in inst.get("carreras", [])]
    asignados, ambiguos, sin_plan, sin_match = [], [], [], []

    for url in listar_pdfs_plan(base):
        try:
            contenido = requests.get(url, headers=H, timeout=60).content
        except Exception:
            sin_plan.append(url)
            continue
        texto = _texto_pdf(contenido)
        plan = plan_desde_resolucion(contenido)
        if not plan or not plan_creible(plan):
            sin_plan.append(url)
            continue
        declarado = carrera_en_resolucion(texto)
        if declarado:
            etiqueta = norm(declarado)
        else:
            etiqueta = clave_desde_archivo(url) + " " + titulo_del_pdf(texto) + " " + texto_titulo(texto)
        puntajes = sorted(((score(etiqueta, c.get("nombre_carrera", "")), c) for c in carreras),
                          key=lambda x: -x[0])
        if not puntajes or puntajes[0][0] < 0.5:
            sin_match.append((url, norm(etiqueta)[:70]))
            continue
        mejor = puntajes[0][0]
        segundo = puntajes[1][0] if len(puntajes) > 1 else 0.0
        tops = [c for s, c in puntajes if s >= mejor - 0.02]
        bases = {base_carrera(c.get("nombre_carrera", "")) for c in tops}
        nuevos = [c for c in tops if not c.get("plan_estudio")] if len(bases) == 1 else []
        if len(bases) > 1 or mejor - segundo < 0.2 or not nuevos:
            ambiguos.append((url, tops[0].get("nombre_carrera", ""), round(mejor, 2)))
            continue
        for c in nuevos:
            c["plan_estudio"] = plan
            c["plan_fuente"] = url
        asignados.append((nuevos[0].get("nombre_carrera", ""), len(plan),
                          sum(len(a["materias"]) for a in plan)))

    if not dry:
        guardar_json(datos, json_nombre)
    return asignados, ambiguos, sin_plan, sin_match


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    for nombre in (args or OBJETIVOS):
        res = procesar(nombre, dry=dry)
        if res is None:
            print(f"⚠️  {nombre}: no está en SITIOS")
            continue
        asignados, ambiguos, sin_plan, sin_match = res
        print(f"\n### {nombre} — {len(asignados)} asignadas" + ("  (DRY RUN)" if dry else ""))
        for n, y, m in asignados:
            print(f"   OK  {str(n)[:52]:54} {y}a/{m}m")
        for url, n, s in ambiguos:
            print(f"   ?   {url.split('/')[-1][:42]:44} -> {str(n)[:30]} (score {s})")
        for url in sin_plan:
            print(f"   XX  {url.split('/')[-1][:60]:62} sin plan legible")
        for url, et in sin_match:
            print(f"   --  {url.split('/')[-1][:60]:62} sin carrera: {et}")


if __name__ == "__main__":
    main()
