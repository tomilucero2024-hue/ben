#!/usr/bin/env python3
"""Completa el plan de estudio de institutos terciarios privados/artísticos.

Cada sitio publica la currícula a su manera, así que hay un adaptador por
institución. Regla de siempre: se extrae solo lo que el sitio oficial publica
como texto; lo que no se puede leer queda pendiente y se lista al final. Nada
se inventa.

Uso:
    python3 scrapers/planes_privados.py [--dry] [archivo.json ...]
"""

import difflib
import json
import re
import sys
import unicodedata

import requests
from bs4 import BeautifulSoup

from scraper_utils import DIR_DATOS, lineas_por_br, _limpiar_materia

H = {"User-Agent": "Mozilla/5.0"}
RE_ANIO = re.compile(r"^(primer|segundo|tercer|cuarto|quinto)\s*a[ñn]o\b", re.I)
MAPA = {"primer": "1", "segundo": "2", "tercer": "3", "cuarto": "4", "quinto": "5"}

# Textos que no son materias sino avisos/normativa pegados al final del plan.
RE_NO_MATERIA = re.compile(
    r"(?i)(importante|resoluci|res\.\s*n|equivalenc|ciclo lectivo|whatsapp|informes|"
    r"inscrip|consultanos|plan de estudios (aprobado|res)|enlace de descarga|"
    r"título|duración|modalidad)"
)

# Sitios que publican todo el plan en una única página central, no en la ficha.
PAGINA_CENTRAL = {
    "san_agustin.json": ("https://instsanagustin.com/planes-de-estudios/", "plan_san_agustin"),
}


def _limpio(texto):
    return re.sub(r"\s+", " ", (texto or "").replace("\xa0", " ")).strip()


def _anio(texto):
    """'Primer año' -> '1º año'; None si no es un encabezado de año."""
    m = RE_ANIO.match(_limpio(texto))
    return MAPA[m.group(1).lower()] + "º año" if m else None


def _materia(linea):
    """Limpia el número de orden y devuelve None si no parece una materia."""
    texto = _limpiar_materia(linea)
    texto = re.sub(r"^\d{1,3}\s+(?=[A-ZÁÉÍÓÚÑ])", "", texto).strip()
    if not texto or len(texto) > 90 or RE_NO_MATERIA.search(texto):
        return None
    return texto


def _texto_li(li):
    """Texto propio del <li>, sin el de <li> anidados (HTML mal cerrado).

    Muchos sitios escriben <li>Materia <li>Materia… sin cerrar; el parser
    anida cada item dentro del anterior y get_text() los concatena todos.
    """
    propio = [str(s) for s in li.find_all(string=True) if s.find_parent("li") is li]
    return _limpio("".join(propio))


def _mats_de_lista(contenedor):
    return [m for m in (_materia(_texto_li(li)) for li in contenedor.find_all("li")) if m]


# --- Adaptadores por institución -------------------------------------------

def _parece_nav(items):
    """True si la lista huele a menú/navegación y no a materias."""
    if not items:
        return True
    largos = sum(1 for x in items if len(x) > 90)
    if len(items) >= 6 and largos > len(items) / 2:
        return True
    ruido = {"inicio", "home", "contacto", "carreras", "menú", "menu", "secciones"}
    return any(_limpio(x).lower() in ruido for x in items[:3])


def plan_encabezado_lista(sopa):
    """Encabezado 'Primer año' seguido de sus materias.

    Las materias pueden venir en el mismo <p> separadas por <br> o en el
    <ul>/<ol> que sigue. Para no confundir una lista de menú con el plan, solo
    se toman las listas que caen entre este encabezado y el próximo.
    """
    todos = sopa.find_all(True)
    pos = {id(el): i for i, el in enumerate(todos)}
    cabeceras = []
    for el in todos:
        if el.name not in ("strong", "b", "h1", "h2", "h3", "h4", "h5"):
            continue
        texto = _limpio(el.get_text(" ", strip=True))
        if len(texto) > 40:
            continue
        anio = _anio(texto)
        if anio:
            cabeceras.append((pos[id(el)], el, anio, texto))
    cabeceras.sort(key=lambda x: x[0])

    plan, vistos = [], set()
    for i, (p, el, anio, texto) in enumerate(cabeceras):
        if anio in vistos:
            continue
        fin = cabeceras[i + 1][0] if i + 1 < len(cabeceras) else len(todos)
        mats = []
        padre = el.parent
        if padre is not None and padre.name == "p":
            lineas = [l for l in lineas_por_br(padre)
                      if _limpio(l).lower() != texto.lower()]
            mats = [m for m in (_materia(l) for l in lineas) if m]
        if not mats:
            for lista in sopa.find_all(["ul", "ol"]):
                if not (p < pos[id(lista)] < fin):
                    continue
                cand = _mats_de_lista(lista)
                if cand and not _parece_nav(cand):
                    mats = cand
                    break
        if not mats:
            # El plan viene en el <p> que sigue al encabezado (formato con <br>).
            for parrafo in sopa.find_all("p"):
                if not (p < pos[id(parrafo)] < fin):
                    continue
                if any(_anio(_limpio(l)) for l in lineas_por_br(parrafo)):
                    continue
                cand = [m for m in (_materia(l) for l in lineas_por_br(parrafo)) if m]
                if cand and not _parece_nav(cand):
                    mats = cand
                    break
        if mats:
            plan.append({"anio": anio, "materias": mats})
            vistos.add(anio)
    return plan or None


def plan_acordeon_elementor(sopa):
    """Acordeón anidado de Elementor: el título es el año y su región la lista."""
    plan, vistos = [], set()
    for titulo in sopa.select(".e-n-accordion-item-title-text"):
        anio = _anio(_limpio(titulo.get_text(" ", strip=True)))
        if not anio or anio in vistos:
            continue
        resumen = titulo.find_parent("summary")
        region = resumen.find_next_sibling("div") if resumen else None
        mats = _mats_de_lista(region) if region else []
        mats = [m for m in mats if not _anio(m)]
        if mats:
            plan.append({"anio": anio, "materias": mats})
            vistos.add(anio)
    return plan or None


def plan_idesa(sopa):
    """IDESA: <h5>AÑO</h5> y las materias en el siguiente widget, con //."""
    plan = []
    for h5 in sopa.find_all("h5"):
        anio = _anio(_limpio(h5.get_text(" ", strip=True)))
        if not anio:
            continue
        cont = h5.find_next("div", class_="elementor-widget-container")
        texto = _limpio(cont.get_text(" ", strip=True)) if cont else ""
        if not texto or texto.lower() == _limpio(h5.get_text(" ", strip=True)).lower():
            cont = cont.find_next("div", class_="elementor-widget-container") if cont else None
            texto = _limpio(cont.get_text(" ", strip=True)) if cont else ""
        mats = [m for m in (_materia(p) for p in re.split(r"\s*//\s*", texto)) if m]
        if mats:
            plan.append({"anio": anio, "materias": mats})
    return plan or None


def plan_fabian_calle(sopa):
    """Fabián Calle: solapas (tab-label) por año y span.materia en su panel."""
    etiquetas = {}
    for a in sopa.select("a.tab-label"):
        etiquetas[a.get("data-tabs-number")] = _anio(_limpio(a.get_text(" ", strip=True)))
    plan = []
    for panel in sopa.select("div.tab-content"):
        anio = etiquetas.get(panel.get("data-tabs-number"))
        mats = [_limpio(s.get_text(" ", strip=True)) for s in panel.select("span.materia")]
        mats = [m for m in mats if m]
        if anio and mats:
            plan.append({"anio": anio, "materias": mats})
    return plan or None


def plan_chopin(sopa):
    """Chopin: <h4 class='gutentor-text'>Año</h4> y la lista gutentor debajo."""
    plan = []
    for h4 in sopa.find_all("h4", class_="gutentor-text"):
        anio = _anio(_limpio(h4.get_text(" ", strip=True)))
        if not anio:
            continue
        lista = h4.find_next(["ul", "ol"])
        if not lista:
            continue
        mats = [_limpio(p.get_text(" ", strip=True))
                for p in lista.select("p.gutentor-single-item-title")]
        mats = [m for m in mats if m] or _mats_de_lista(lista)
        if mats:
            plan.append({"anio": anio, "materias": mats})
    return plan or None


def plan_insutec_petroleo(sopa):
    """INSUTEC Petróleo y Gas: acordeón con los módulos dentro del contenido."""
    plan = []
    for cabeza in sopa.select("[main-text]"):
        anio = _anio(cabeza.get("main-text") or "")
        if not anio:
            continue
        cont = cabeza.find_next_sibling("div", class_=re.compile("accordion-content"))
        mats = []
        if cont:
            for linea in lineas_por_br(cont):
                m = _materia(re.sub(r"^[–—\-]\s*", "", linea))
                if m:
                    mats.append(m)
        if mats:
            plan.append({"anio": anio, "materias": mats})
    return plan or None


def plan_epd(sopa):
    """EPD: <h3>PRIMER AÑO</h3> y las materias en los <p> que siguen."""
    plan, actual = [], None
    for el in sopa.find_all(["h3", "h4", "h5", "p"]):
        texto = _limpio(el.get_text(" ", strip=True))
        if el.name in ("h3", "h4"):
            anio = _anio(texto)
            if anio:
                actual = {"anio": anio, "materias": []}
                plan.append(actual)
                continue
        if actual is not None and el.name == "p":
            for linea in lineas_por_br(el):
                m = _materia(linea)
                if m:
                    actual["materias"].append(m)
    return [x for x in plan if x["materias"]] or None


def plan_insutec_construcciones(sopa):
    """INSUTEC Construcciones: tablas por cuatrimestre con 'Denominación'."""
    formatos = {"MA", "TA", "SE", "PP", "MO", "PRO"}
    plan = []
    for tabla in sopa.find_all("table"):
        primera = tabla.find("tr")
        m = re.search(r"(primer|segundo|tercer)\s*a", primera.get_text(" ", strip=True), re.I) \
            if primera else None
        if not m:
            continue
        anio = MAPA[m.group(1).lower()] + "º año"
        mats = []
        for fila in tabla.find_all("tr"):
            celdas = [_limpio(c.get_text(" ", strip=True)) for c in fila.find_all(["td", "th"])]
            for i, celda in enumerate(celdas):
                if i == 0 or celda in formatos or re.fullmatch(r"\d+", celda):
                    continue
                if re.fullmatch(r"\d{1,2}", celdas[i - 1]):
                    mat = _materia(celda)
                    if mat:
                        mats.append(mat)
        if mats:
            plan.append({"anio": anio, "materias": mats})
    return plan or None


def plan_san_agustin(sopa):
    """San Agustín: página central con un acordeón por carrera.

    Devuelve {nombre_carrera: [tramos]}. Cada carrera arranca en su <h1> y sus
    paneles vc_tta-panel cuelgan debajo.
    """
    carreras, actual = {}, None
    for el in sopa.find_all(["h1", "div"]):
        if el.name == "h1":
            texto = _limpio(el.get_text(" ", strip=True))
            actual = texto if "Tecnicatura" in texto else None
            if actual is not None and actual not in carreras:
                carreras[actual] = []
            continue
        if actual is None or "vc_tta-panel" not in (el.get("class") or []):
            continue
        titulo = el.select_one(".vc_tta-panel-title")
        anio = _anio(_limpio(titulo.get_text(" ", strip=True))) if titulo else None
        if not anio:
            continue
        cuerpo = el.select_one(".vc_tta-panel-body")
        mats = _mats_de_lista(cuerpo) if cuerpo else []
        if mats:
            carreras[actual].append({"anio": anio, "materias": mats})
    return {n: p for n, p in carreras.items() if p} or None


ADAPTADORES = {
    "rayuela.json": plan_encabezado_lista,
    "idesa.json": plan_idesa,
    "fabian_calle.json": plan_fabian_calle,
    "chopin.json": plan_chopin,
    "trinidad.json": lambda s: plan_encabezado_lista(s) or plan_acordeon_elementor(s),
}

# Carreras cuyo plan vive en una URL distinta a la de su ficha (o en una página
# central): archivo -> carrera -> (url, adaptador).
OVERRIDES = {
    "insutec.json": {
        "Tecnicatura Superior en Higiene, Seguridad y Ambiente":
            ("https://www.insutec.edu.ar/higiene/plan-de-estudios/", "plan_infd"),
        "Tecnicatura Superior en Minería":
            ("https://www.insutec.edu.ar/mineria/plan-de-estudio/", "plan_infd"),
        "Tecnicatura Superior en Metalmecánica":
            ("https://www.insutec.edu.ar/metalmecanica/", "plan_infd"),
        "Tecnicatura Superior en Energías Renovables":
            ("https://www.insutec.edu.ar/tecnicatura-superior-en-energias-renovables-en-mendoza/",
             "plan_infd"),
        "Tecnicatura Superior en Petróleo y Gas":
            ("https://www.insutec.edu.ar/petroleo/plan-de-estudios/", "plan_insutec_petroleo"),
        "Tecnicatura Superior en Construcciones Sustentables":
            ("https://www.insutec.edu.ar/nueva-carrera-tecnicactura-superior-en-construcciones-sustentables/",
             "plan_insutec_construcciones"),
    },
    "imei.json": {
        "Profesorado en Educación Primaria":
            ("https://maipu-infd.mendoza.edu.ar/sitio/plan-de-estudios/", "plan_infd"),
        "Profesorado en Educación Inicial":
            ("https://maipu-infd.mendoza.edu.ar/sitio/plan-de-estudios-2/", "plan_infd"),
    },
    "insrp.json": {
        "Profesorado en Educación Primaria":
            ("https://insrp-infd.mendoza.edu.ar/sitio/plan-de-estudios-2/", "plan_infd"),
        "Tecnicatura Superior en Asistencia Gerontológica":
            ("https://insrp-infd.mendoza.edu.ar/sitio/plan-de-estudios-3/", "plan_infd"),
    },
    "epd.json": {
        "Tecnicatura Superior en Periodismo Deportivo":
            ("https://epdmendoza.com.ar/plan-de-estudio/", "plan_epd"),
    },
    "higiene_seguridad.json": {
        "Tecnicatura Superior en Higiene y Seguridad Laboral con Orientación en Calidad y Medio Ambiente":
            ("https://www.insutec.edu.ar/higiene/plan-de-estudios/", "plan_infd"),
    },
}


def plan_infd(sopa):
    """Plan de la plataforma *-infd (años sueltos y materias debajo)."""
    from scraper_utils import extraer_plan_anual
    plan = extraer_plan_anual(sopa) or []
    vistos, limpio = set(), []
    for tramo in plan:
        if tramo["anio"] in vistos:
            continue
        vistos.add(tramo["anio"])
        limpio.append(tramo)
    return limpio or None


def _normal(nombre):
    sin = unicodedata.normalize("NFKD", nombre or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9 ]", " ", sin.lower())).strip()


def _mejor_clave(nombre, claves):
    objetivo = _normal(nombre)
    mejor, puntaje = None, 0.0
    for clave in claves:
        s = difflib.SequenceMatcher(None, objetivo, _normal(clave)).ratio()
        if s > puntaje:
            mejor, puntaje = clave, s
    return mejor if puntaje >= 0.6 else None


def _indent_original(ruta):
    """Indentación del JSON existente, para no reformatear todo el archivo."""
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            if linea.strip() and linea.lstrip() != linea:
                return len(linea) - len(linea.lstrip())
    return 1


def _guardar(datos, ruta):
    indent = _indent_original(ruta)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=indent)
        f.write("\n")


def procesar(json_nombre, sopas_guardadas=None, dry=False):
    ruta = DIR_DATOS / json_nombre
    datos = json.load(open(ruta, encoding="utf-8"))
    carreras = [c for inst in datos.get("instituciones", [])
                for c in inst.get("carreras", [])]
    central = PAGINA_CENTRAL.get(json_nombre)
    if central:
        url, nombre_adap = central
        adap = globals()[nombre_adap]
        sopa = _sopa(url, sopas_guardadas)
        mapa = adap(sopa) if sopa else None
        if not mapa:
            return [], [(json_nombre, "(página central)", url)]
        asignados = []
        for c in carreras:
            if c.get("plan_estudio"):
                continue
            clave = _mejor_clave(c["nombre_carrera"], list(mapa))
            if clave:
                c["plan_estudio"] = mapa[clave]
                c["plan_fuente"] = url
                asignados.append((c["nombre_carrera"], len(mapa[clave]),
                                  sum(len(a["materias"]) for a in mapa[clave])))
        if asignados and not dry:
            _guardar(datos, ruta)
        return asignados, []

    adap = ADAPTADORES.get(json_nombre)
    overrides = OVERRIDES.get(json_nombre, {})
    if not adap and not overrides:
        return [], [(json_nombre, "(sin adaptador)", "")]
    hechos, pendientes = [], []
    for c in carreras:
        if c.get("plan_estudio"):
            continue
        nombre = c.get("nombre_carrera", "")
        if nombre in overrides:
            url, nombre_adap = overrides[nombre]
            adap_c = globals()[nombre_adap]
        else:
            url, adap_c = c.get("link_oficial"), adap
        if not url or not adap_c:
            pendientes.append((json_nombre, nombre, url or "(sin link)"))
            continue
        sopa = _sopa(url, sopas_guardadas)
        plan = adap_c(sopa) if sopa else None
        if plan:
            c["plan_estudio"] = plan
            c["plan_fuente"] = url
            hechos.append((nombre, len(plan),
                           sum(len(a["materias"]) for a in plan)))
        else:
            pendientes.append((json_nombre, nombre, url))
    if hechos and not dry:
        _guardar(datos, ruta)
    return hechos, pendientes


def _sopa(url, guardadas):
    if guardadas and url in guardadas:
        return BeautifulSoup(guardadas[url], "html.parser")
    try:
        r = requests.get(url, headers=H, timeout=30)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"   !! no se pudo leer {url}: {type(e).__name__}")
        return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    objetivos = args or list(ADAPTADORES) + list(PAGINA_CENTRAL) + list(OVERRIDES)
    total_h = total_p = 0
    for nombre in objetivos:
        hechos, pendientes = procesar(nombre, dry=dry)
        print(f"\n### {nombre} — {len(hechos)} completadas" + ("  (DRY RUN)" if dry else ""))
        for n, a, m in hechos:
            print(f"   OK  {str(n)[:52]:54} {a}a/{m}m")
        for _, n, u in pendientes:
            print(f"   --  {str(n)[:52]:54} {u}")
        total_h += len(hechos)
        total_p += len(pendientes)
    print(f"\nTOTAL: {total_h} completadas / {total_p} siguen pendientes")


if __name__ == "__main__":
    main()
