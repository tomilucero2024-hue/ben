"""Completa el plan de estudio en TEXTO leyendo los PDF de los IES.

Muchos IES publican el plan como PDF en la biblioteca de medios de WordPress
(expuesta por la REST API). Este script:

1. Consulta `{base}/sitio/wp-json/wp/v2/media?search=plan` de cada IES.
2. Filtra los PDFs que son planes de estudio.
3. Los mapea a cada carrera por título interno del PDF + nombre de archivo.
4. Extrae el texto (`pdftotext`) y lo estructura en años/materias.
5. Guarda `plan_estudio` + `plan_fuente` (URL del PDF) en el JSON del IES.

No inventa: los PDFs escaneados (sin texto) y los que no se pueden mapear
quedan pendientes y se listan al final.

Uso:
    python3 scrapers/planes_pdf.py [--dry] [archivo.json ...]
"""

import json
import re
import sys
import unicodedata
from urllib.parse import urlparse

import requests

from pdf_utils import _texto_pdf, plan_desde_texto
from scraper_utils import DIR_DATOS, guardar_json

H = {"User-Agent": "Mozilla/5.0"}

# IES con biblioteca de medios WordPress y PDFs de planes.
SITIOS = {
    "ies9001.json": "https://ens9001-infd.mendoza.edu.ar",
    "ies9003.json": "https://ens9003-infd.mendoza.edu.ar",
    "ies9004.json": "https://ens9004-infd.mendoza.edu.ar",
    "ies9005.json": "https://ens9005-infd.mendoza.edu.ar",
    "ies9009.json": "https://ies9009-infd.mendoza.edu.ar",
    "ies9010.json": "https://ies9010-infd.mendoza.edu.ar",
    "ies9016.json": "https://ief9016-infd.mendoza.edu.ar",
    "ies9018.json": "https://ies9018malargue.edu.ar",
    "ies9023.json": "https://ies9023-infd.mendoza.edu.ar",
    "ies9024.json": "https://ies9024-infd.mendoza.edu.ar",
    "ies9026.json": "https://ies9026-infd.mendoza.edu.ar",
    "ies9027.json": "https://ies9027-infd.mendoza.edu.ar",
    "ies9029.json": "https://www.ies9029.edu.ar",
    "ies9030.json": "https://institutodelbicentenario-infd.mendoza.edu.ar",
}

# Abreviaturas de archivo -> texto del nombre de carrera.
ALIAS = {
    "pep": "profesorado educacion primaria",
    "pee": "profesorado educacion especial",
    "ter": "energias renovables",
    "tenol": "enologia industrias frutihorticolas",
    "tagro": "agronomica",
    "tlogis": "logistica",
    "tturismo": "turismo",
    "adm pub legis": "administracion publica legislatura",
    "adm pub infope": "administracion publica infope",
    "adm pub distancia": "administracion publica distancia",
    "adm emp dist": "administracion de empresas",
    "prof tecnicos": "modalidad tecnico profesional",
    "6079": "desarrollo software",
    "enfermero": "enfermeria profesional",
}

STOP = {"de", "del", "la", "el", "en", "y", "e", "los", "las", "a", "al",
        "para", "con", "por", "o", "u", "plan", "estudios", "tecnicatura",
        "superior", "profesorado", "sede", "central", "agrelo", "las",
        "catitas", "de"}

RE_PDF_PLAN = re.compile(r"plan.{0,3}(de.{0,3})?(estudio|estudios)|plan-", re.I)


def norm(texto):
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    texto = re.sub(r"[^a-zA-Z0-9 ]", " ", texto.lower())
    return re.sub(r"\s+", " ", texto).strip()


def tokens(texto):
    return {t for t in norm(texto).split() if t and t not in STOP}


def clave_desde_archivo(nombre):
    base = norm(nombre.rsplit("/", 1)[-1].rsplit(".", 1)[0])
    for abrev, expansion in ALIAS.items():
        if abrev in base:
            base += " " + expansion
    return base


def titulo_del_pdf(texto):
    """Líneas previas al primer año: suelen contener el nombre de la carrera."""
    partes = []
    for linea in texto.splitlines():
        linea = linea.strip()
        if re.match(r"^(primer|segundo|tercer|cuarto|quinto|sexto|1er|2do|3ro|4to)\s*a[ñn]o", linea, re.I):
            break
        if linea and not re.match(r"^plan de estudios", linea, re.I):
            partes.append(linea)
    return " ".join(partes)


def score(etiqueta, carrera):
    """Qué fracción de los tokens de la carrera cubre la etiqueta del PDF."""
    A, B = tokens(etiqueta), tokens(carrera)
    if not B:
        return 0.0
    return len(A & B) / len(B)


def base_carrera(carrera):
    """Nombre normalizado sin tokens de sede (para detectar la misma carrera)."""
    return " ".join(sorted(tokens(carrera)))


def plan_creible(plan):
    """Descarta documentos que no son un plan (resoluciones con cientos de líneas)."""
    if not plan or len(plan) > 6:
        return False
    total = sum(len(a["materias"]) for a in plan)
    return total <= 60 and all(len(a["materias"]) <= 40 for a in plan)


def listar_pdfs_plan(base):
    for path in ("/sitio/wp-json/wp/v2/media?search=plan&per_page=100",
                 "/wp-json/wp/v2/media?search=plan&per_page=100"):
        try:
            r = requests.get(base + path, headers=H, timeout=25)
            if r.status_code == 200 and "json" in (r.headers.get("content-type") or ""):
                items = [(m.get("source_url", ""), m.get("date", "")) for m in r.json()]
                pdfs = [(u, d) for u, d in items
                        if u.lower().endswith(".pdf") and RE_PDF_PLAN.search(u)]
                pdfs.sort(key=lambda x: x[1], reverse=True)  # el más nuevo primero
                return [u for u, _ in pdfs]
        except Exception:
            continue
    return []


def procesar(json_nombre, dry=False):
    base = SITIOS.get(json_nombre)
    if not base:
        return None
    datos = json.load(open(DIR_DATOS / json_nombre, encoding="utf-8"))
    carreras = [c for inst in datos.get("instituciones", []) for c in inst.get("carreras", [])]
    pdfs = listar_pdfs_plan(base)
    asignados, compartidos, ambiguos, sin_texto, sin_match = [], [], [], [], []

    for url in pdfs:
        texto = _texto_pdf(requests.get(url, headers=H, timeout=60).content)
        plan = plan_desde_texto(texto)
        etiqueta = clave_desde_archivo(url) + " " + titulo_del_pdf(texto)
        if not plan or not plan_creible(plan):
            sin_texto.append(url)
            continue
        puntajes = sorted(((score(etiqueta, c.get("nombre_carrera", "")), c) for c in carreras),
                          key=lambda x: -x[0])
        if not puntajes or puntajes[0][0] < 0.5:
            sin_match.append((url, etiqueta[:60]))
            continue
        mejor = puntajes[0][0]
        tops = [c for s, c in puntajes if s >= mejor - 0.02]
        bases = {base_carrera(c.get("nombre_carrera", "")) for c in tops}
        if len(tops) > 1 and len(bases) == 1:
            ganadores = tops          # misma carrera en varias sedes
            compartidos.append((url, [c.get("nombre_carrera", "") for c in ganadores]))
        else:
            ganadores = [tops[0]]     # una sola
            if len(tops) > 1:
                ambiguos.append((url, tops[0].get("nombre_carrera", ""), round(mejor, 2)))
        nuevos = [c for c in ganadores if not c.get("plan_estudio")]
        for c in nuevos:
            c["plan_estudio"] = plan
            c["plan_fuente"] = url
        if nuevos and len(ganadores) == 1:
            asignados.append((nuevos[0].get("nombre_carrera", ""),
                              len(plan), sum(len(a["materias"]) for a in plan)))

    if not dry:
        guardar_json(datos, json_nombre)
    return asignados, compartidos, ambiguos, sin_texto, sin_match


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    objetivos = args or list(SITIOS)
    for nombre in objetivos:
        res = procesar(nombre, dry=dry)
        if res is None:
            continue
        asignados, compartidos, ambiguos, sin_texto, sin_match = res
        print(f"\n### {nombre} — {len(asignados)} asignadas"
              + ("  (DRY RUN)" if dry else ""))
        for n, y, m in asignados:
            print(f"   OK  {str(n)[:52]:54} {y}a/{m}m")
        for url, nombres in compartidos:
            print(f"   ==  {url.split('/')[-1][:40]:42} compartido: {', '.join(x[:26] for x in nombres)}")
        for url, n, s in ambiguos:
            print(f"   ?   {url.split('/')[-1][:40]:42} -> {str(n)[:30]} (score {s})")
        for url in sin_texto:
            print(f"   XX  {url.split('/')[-1][:60]:62} sin plan legible (escaneado o resolución)")
        for url, et in sin_match:
            print(f"   --  {url.split('/')[-1][:60]:62} sin carrera: {et}")


if __name__ == "__main__":
    main()
