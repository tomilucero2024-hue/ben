"""Completa el plan de estudio en TEXTO de las carreras que quedaron sin plan.

Regla: si el sitio oficial publica el plan como texto (encabezados + listas,
tablas con los años en la cabecera, o un PDF con texto), se extrae y se guarda
en `plan_estudio`. No se inventa nada: lo que no se puede leer queda pendiente y
se lista al final.

Uso:
    python3 scrapers/planes_faltantes.py [archivo.json ...]

Sin argumentos procesa los IES que quedaron pendientes.
"""

import json
import re
import sys
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from pdf_utils import primer_pdf_de_plan, plan_desde_url_pdf
from scraper_utils import DIR_DATOS, guardar_json

H = {"User-Agent": "Mozilla/5.0"}
RE_ANIO = re.compile(r"(primer|segundo|tercer|cuarto|quinto|sexto)\s*a[ñn]o", re.I)
RE_ANIO_FULL = re.compile(
    r"^(primer|segundo|tercer|cuarto|quinto|sexto|1er|2do|3ro|4to|1º|2º|3º|4º)\s*"
    r"(a[ñn]o|semestre|cuatrimestre)\s*:?\s*$",
    re.I,
)
MAPA = {"primer": "1", "segundo": "2", "tercer": "3", "cuarto": "4",
        "quinto": "5", "sexto": "6"}
NAV = {"home", "inicio", "contacto", "carreras", "menu", "menú", "buscar"}


def _limpio(texto):
    return re.sub(r"\s+", " ", texto.replace("\xa0", " ")).strip()


# --- Adaptadores por institución -------------------------------------------

def plan_isteec(sopa):
    """ISTEEC: lista de materias debajo del título 'Plan de estudios'."""
    for h in sopa.find_all(["h2", "h3"]):
        if "plan de estudios" in h.get_text(" ", strip=True).lower():
            ul = h.find_next("ul")
            if ul:
                mats = [_limpio(li.get_text(" ", strip=True)) for li in ul.find_all("li")]
                mats = [m for m in mats if m]
                if mats:
                    return [{"anio": "Materias", "materias": mats}]
    return None


def plan_curso_anual(sopa):
    """Varios IES: el plan son varios <ul> de materias (uno por año) sin
    encabezado de año, agrupados bajo el título de la carrera."""
    anios = ["Primer año", "Segundo año", "Tercer año", "Cuarto año", "Quinto año"]
    listas = []
    for ul in sopa.find_all(["ul", "ol"]):
        items = [_limpio(li.get_text(" ", strip=True)) for li in ul.find_all("li")]
        items = [i for i in items if i]
        if len(items) < 8:
            continue
        cabezas = [i.lower() for i in items[:4]]
        if any(any(n in c for n in NAV) for c in cabezas):
            continue
        if sum(1 for c in cabezas if "tecnicatura superior" in c or "profesorado" in c) >= 2:
            continue
        listas.append(items)
    if len(listas) < 2:
        return None
    return [
        {"anio": anios[i] if i < len(anios) else f"Año {i + 1}", "materias": m}
        for i, m in enumerate(listas)
    ]


def plan_tabla_anios(sopa):
    """Tabla donde la cabecera son los años y cada celda trae las materias."""
    plan = []
    for tabla in sopa.find_all("table"):
        filas = tabla.find_all("tr")
        if len(filas) < 2:
            continue
        cabecera = [_limpio(c.get_text(" ", strip=True)) for c in filas[0].find_all(["td", "th"])]
        cabecera = [c for c in cabecera if c]
        if len(cabecera) < 1 or not all(RE_ANIO.search(c) for c in cabecera):
            continue
        for fila in filas[1:]:
            celdas = fila.find_all(["td", "th"])
            for i, celda in enumerate(celdas):
                if i >= len(cabecera):
                    break
                materias = [_limpio(m) for m in celda.get_text("\n", strip=True).split("\n")]
                materias = [m for m in materias if m]
                if materias:
                    plan.append({"anio": cabecera[i], "materias": materias})
    return plan or None


def plan_modulos(sopa):
    """Cursos de formación continua: lista de módulos tras 'Módulos:'."""
    for el in sopa.find_all(["h2", "h3", "h4", "h5", "p", "strong", "b"]):
        if not re.fullmatch(r"m[óo]dulos\s*:?", _limpio(el.get_text(" ", strip=True)), re.I):
            continue
        modulos = []
        for sib in el.next_elements:
            nombre = getattr(sib, "name", None)
            if nombre in ("h2", "h3", "h4", "h5"):
                break
            if nombre in ("li", "p"):
                t = _limpio(sib.get_text(" ", strip=True))
                if not t:
                    continue
                if re.search(r"arancel|cooperadora|pregunta|consult|contact|¿ten", t, re.I):
                    break
                modulos.append(t)
        modulos = [m for m in modulos if m and not re.search(r"arancel|cooperadora|pregunta", m, re.I)]
        if modulos:
            return [{"anio": "Módulos", "materias": modulos}]
    return None


def plan_encabezados(sopa):
    """Encabezados 'Primer año' … seguidos de su <ul> de materias."""
    plan = []
    for h in sopa.find_all(["h2", "h3", "h4", "h5"]):
        texto = _limpio(h.get_text(" ", strip=True))
        if len(texto) > 40 or not RE_ANIO_FULL.match(texto):
            continue
        ul = h.find_next(["ul", "ol"])
        if not ul:
            continue
        materias = [_limpio(li.get_text(" ", strip=True)) for li in ul.find_all("li")]
        materias = [m for m in materias if m]
        if materias:
            plan.append({"anio": texto.rstrip(":").strip(), "materias": materias})
    return plan or None


def plan_ipa_accordion(sopa):
    """IPA (9-014): acordeón Elementor; el título del tab es el año y su
    contenido un <ul> de materias."""
    plan = []
    for title in sopa.select("a.elementor-accordion-title"):
        texto = _limpio(title.get_text(" ", strip=True))
        if len(texto) > 40 or not RE_ANIO_FULL.match(texto):
            continue
        tab = title.find_parent("div", class_="elementor-tab-title")
        if not tab:
            continue
        content = tab.find_next_sibling("div", class_="elementor-tab-content")
        if not content:
            continue
        materias = [_limpio(li.get_text(" ", strip=True)) for li in content.find_all("li")]
        materias = [m for m in materias if m]
        if materias:
            plan.append({"anio": texto.rstrip(":").strip(), "materias": materias})
    return plan or None


def plan_anios_br(sopa):
    """Un <p> por año: '<strong>Primer Año</strong><br/>materia<br/>materia…'
    (Escuela de Cine 9-017)."""
    plan = []
    for p in sopa.find_all("p"):
        strong = p.find("strong")
        if not strong:
            continue
        if len(p.find_all("strong")) > 1:
            continue
        texto = _limpio(strong.get_text(" ", strip=True))
        if len(texto) > 40 or not RE_ANIO_FULL.match(texto):
            continue
        materias, trozo = [], []
        def _flush():
            t = " ".join("".join(trozo).split()).strip()
            if t:
                materias.append(t)
            trozo.clear()
        for node in p.children:
            if node is strong:
                continue
            if node.name == "br":
                _flush()
            elif node.name is None:
                trozo.append(str(node))
            else:
                trozo.append(node.get_text(" ", strip=True))
        _flush()
        if materias:
            plan.append({"anio": texto.rstrip(":").strip(), "materias": materias})
    return plan or None


ADAPTADORES = {
    "ies9013.json": plan_isteec,
    "ies9018.json": plan_curso_anual,
    "ies9016.json": plan_tabla_anios,
    "ies9008.json": plan_encabezados,
    "ies9015.json": plan_modulos,
    "ies9014.json": plan_ipa_accordion,
    "ies9017.json": plan_anios_br,
}


def plan_desde_pagina(sopa, url):
    """Devuelve (plan, fuente) usando texto HTML o, si no, un PDF del plan."""
    for fn in (plan_encabezados, plan_tabla_anios):
        plan = fn(sopa)
        if plan:
            return plan, url
    href = primer_pdf_de_plan(sopa)
    if href:
        pdf_url = urljoin(url, href)
        plan = plan_desde_url_pdf(pdf_url)
        if plan:
            return plan, pdf_url
    return None, None


def procesar(json_nombre):
    ruta = DIR_DATOS / json_nombre
    datos = json.load(open(ruta, encoding="utf-8"))
    adapatador = ADAPTADORES.get(json_nombre)
    hechos, pendientes, errores = [], [], []
    for inst in datos.get("instituciones", []):
        for c in inst.get("carreras", []):
            if c.get("plan_estudio"):
                continue
            url = c.get("link_oficial")
            nombre = c.get("nombre_carrera", "")
            if not url:
                pendientes.append((inst["nombre"], nombre, "(sin link oficial)"))
                continue
            try:
                req = requests.get(url, headers=H, timeout=25)
                sopa = BeautifulSoup(req.text, "html.parser")
                plan, fuente = (None, None)
                if adapatador:
                    plan = adapatador(sopa)
                    fuente = url if plan else None
                if not plan:
                    plan, fuente = plan_desde_pagina(sopa, url)
                if plan:
                    c["plan_estudio"] = plan
                    c["plan_fuente"] = fuente
                    hechos.append((nombre, len(plan), sum(len(a["materias"]) for a in plan)))
                else:
                    pendientes.append((inst["nombre"], nombre, url))
            except Exception as e:
                errores.append((nombre, url, type(e).__name__))
    guardar_json(datos, json_nombre)
    return hechos, pendientes, errores


def main():
    objetivos = sys.argv[1:] or [
        "ies9013.json", "ies9018.json", "ies9016.json", "ies9008.json",
        "ies_godoycruz.json", "ies9023.json", "ies9029.json",
    ]
    total_h = total_p = 0
    for nombre in objetivos:
        try:
            hechos, pendientes, errores = procesar(nombre)
        except FileNotFoundError:
            print(f"⚠️  {nombre}: no existe")
            continue
        print(f"\n### {nombre} — {len(hechos)} completadas")
        for n, y, m in hechos:
            print(f"   OK  {str(n)[:52]:54} {y} años / {m} materias")
        for inst, n, u in pendientes:
            print(f"   --  {str(n)[:52]:54} {u}")
        for n, u, e in errores:
            print(f"   !!  {str(n)[:52]:54} {e} {u}")
        total_h += len(hechos)
        total_p += len(pendientes) + len(errores)
    print(f"\nTOTAL: {total_h} completadas / {total_p} siguen pendientes")


if __name__ == "__main__":
    main()
