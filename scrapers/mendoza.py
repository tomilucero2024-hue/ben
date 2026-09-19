import os
import re
import subprocess
import tempfile
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from scraper_utils import (carreras_guardadas, es_duracion_real, guardar_json,
                           limpiar_texto, mejor_duracion, parece_carrera)


# ---------------------------------------------------------------------------
# Plan de estudio
# ---------------------------------------------------------------------------
# La UM publica la currícula dentro de una pestaña ("Plan de Estudio" en
# .fl-tabs-label) pero el contenido cambia de forma según la carrera:
#   * <h3>1er Año</h3> + <p>Materia<br/>Materia…</p>        (Abogacía, Escribanía)
#   * <h3>1er Año</h3> + <h4>Primer semestre</h4> + <p>…</p>  (Radiología, Higiene)
#   * <p><strong>Primer Año</strong></p> + <p>Materia<br/>…</p> (Contador)
#   * <p><strong>Curso: 1</strong><br/>Asignatura<br/>…</p>    (Ingenierías)
# Las carreras que sólo ofrecen un PDF ("Plan de Estudios detallado") se leen con
# pdftotext (ver más abajo); si el PDF es una imagen sin texto, quedan sin plan:
# no inventamos una currícula que la web no publica.
#
# Sin plan público (verificado, la web no lo publica de ninguna forma):
#   * Tecnicatura en Desarrollo de Videojuegos (sólo pestañas Presentación /
#     Perfil / Régimen, sin materias).
#   * Corredor Inmobiliario. Título complementario de Arquitectura (sin pestaña
#     de plan ni PDF).
ORDEN = (r"primer|segundo|tercer|cuarto|quinto|sexto|s[eé]ptimo|octavo|"
         r"noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo")
ORDINALES = ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto",
             "séptimo", "octavo", "noveno", "décimo", "undécimo", "duodécimo"]
RE_ANIO_ORD = re.compile(rf"^(?:{ORDEN})\s+a[nñ]os?$", re.I)
RE_ANIO_NUM = re.compile(r"^(\d{1,2})\s*(?:er|ro|do|to|mo|vo|no|[°º])?\s*a[nñ]os?$", re.I)
RE_PERIODO_ORD = re.compile(rf"^(?:{ORDEN})\s+(semestre|cuatrimestre|trimestre|m[oó]dulo)$", re.I)
RE_PERIODO_NUM = re.compile(
    r"^(\d{1,2})\s*(?:er|ro|do|to|mo|vo|no|[°º])?\s+(semestre|cuatrimestre|trimestre|m[oó]dulo)$", re.I)
RE_CURSO = re.compile(r"^curso\s*:?\s*(\d{1,2})$", re.I)
RE_IGNORAR = re.compile(r"(?i)^[aá]reas?\s+de\s+orientaci[oó]n")
PERIODOS_SUELTOS = {"anual": "Anual", "anuales": "Anuales",
                    "semestral": "Semestral", "semestrales": "Semestrales"}
ENCABEZADOS = {"asignatura", "asignaturas", "materia", "materias", "código",
               "codigo", "carga horaria", "horas", "régimen", "regimen",
               "requisitos", "correlatividades", "asignaturas correlativas"}
RE_REGIMEN = re.compile(r"(?:\s*\((?:s|a|p|s\d+)\))+\s*$", re.I)
RE_DESCARTE = re.compile(r"(?i)^(?:\*|nota\b|referencias?\b)")


def _ordinal(n):
    return ORDINALES[n - 1].capitalize() if 1 <= n <= len(ORDINALES) else None


def _tramo(texto):
    """Etiqueta normalizada si el texto es un tramo (año, período o curso), o None."""
    t = limpiar_texto(texto).strip(" .:·-—")
    if not t:
        return None
    m = RE_CURSO.match(t)
    if m:
        return f"Curso {int(m.group(1))}"
    m = RE_ANIO_NUM.match(t)
    if m:
        o = _ordinal(int(m.group(1)))
        return f"{o} año" if o else t
    if RE_ANIO_ORD.match(t):
        return f"{t.split()[0].capitalize()} año"
    m = RE_PERIODO_NUM.match(t)
    if m:
        o = _ordinal(int(m.group(1)))
        return f"{o} {m.group(2).lower()}" if o else t
    m = RE_PERIODO_ORD.match(t)
    if m:
        return f"{t.split()[0].capitalize()} {m.group(1).lower()}"
    if t.lower() in PERIODOS_SUELTOS:
        return PERIODOS_SUELTOS[t.lower()]
    return None


def _titulo_legible(t):
    t = limpiar_texto(t)
    return t.capitalize() if t.isupper() and len(t) > 4 else t


def _lineas(p):
    """Materias de un <p>: la UM las separa con <br> y les cuelga el régimen."""
    partes = re.split(r"<br\s*/?>", p.decode_contents(), flags=re.I)
    salida = []
    for parte in partes:
        t = limpiar_texto(re.sub(r"<[^>]+>", " ", parte))
        t = RE_REGIMEN.sub("", t).strip(" .").rstrip("*").strip()
        if t and t.lower() not in ENCABEZADOS and not RE_DESCARTE.match(t):
            salida.append(t)
    return salida


RE_PLAN_TAB = re.compile(r"planes?\s+de\s+estudio", re.I)


def _panel_plan(sopa):
    for panel in sopa.select(".fl-tabs-panel-content"):
        rotulo = panel.find_previous(class_="fl-tabs-label")
        texto = limpiar_texto(rotulo.get_text(" ", strip=True)) if rotulo else ""
        h2 = panel.find("h2")
        if h2:
            texto += " " + limpiar_texto(h2.get_text(" ", strip=True))
        if RE_PLAN_TAB.search(texto):
            return panel
    return None


def _plan_régimen_estudios(sopa):
    """Algunas tecnicaturas (Desarrollo de Software) listan las materias como
    h4 sueltos dentro del tab "Régimen de estudios", sin años ni PDF. Usamos el
    tab como un único tramo plano; si el tab es solo prosa, devolvemos None."""
    for panel in sopa.select(".fl-tabs-panel-content"):
        rotulo = panel.find_previous(class_="fl-tabs-label")
        texto = limpiar_texto(rotulo.get_text(" ", strip=True)) if rotulo else ""
        if not re.search(r"r[eé]gimen\s+de\s+estudios", texto, re.I):
            continue
        materias = []
        for el in panel.find_all(["h3", "h4", "strong", "b"]):
            m = limpiar_texto(el.get_text(" ", strip=True))
            if m and m not in materias and RE_PLAN_TAB.search(m):
                continue
            if m and m not in materias and len(m) >= 3:
                materias.append(m)
        # Quitamos el encabezado del propio tab ("Régimen de estudios").
        materias = [
            m for m in materias
            if not re.search(r"r[eé]gimen\s+de\s+estudios", m, re.I)
        ]
        if len(materias) >= 5:
            return [{"anio": "Régimen de estudios", "materias": materias}]
    return None


def extraer_plan(sopa):
    panel = _panel_plan(sopa)
    if panel is None:
        return None
    plan = []
    actual = None
    anio_base = None
    ignorar = False

    def nuevo(etiqueta):
        nonlocal actual
        actual = {"anio": etiqueta, "materias": []}
        plan.append(actual)

    def abrir(etiqueta, es_anio):
        nonlocal anio_base, ignorar
        if es_anio:
            anio_base = etiqueta
            nuevo(etiqueta)
        elif etiqueta.startswith("Curso"):
            anio_base = None
            nuevo(etiqueta)
        elif anio_base:
            nuevo(f"{anio_base} — {etiqueta}")
        else:
            nuevo(etiqueta)
        ignorar = False

    for el in panel.find_all(["h3", "h4", "p"]):
        texto = limpiar_texto(el.get_text(" ", strip=True))
        if not texto:
            continue

        if el.name in ("h3", "h4"):
            if RE_IGNORAR.match(texto):
                ignorar = True
                continue
            etiqueta = _tramo(texto)
            if etiqueta is None:
                # Título genérico ("Plan de Estudios", "Plan de Estudios 2019"):
                # no es un tramo; si es un h4 lo usamos como sección (Condición
                # final de egreso), si es h3 lo salteamos.
                if el.name == "h4":
                    anio_base = None
                    abrir(_titulo_legible(texto), False)
                continue
            if (el.name == "h4" and "año" not in etiqueta and anio_base
                    and actual is not None and actual["anio"] == anio_base):
                # "Anuales" / "Primer semestre" cuelgan del año que ya abrimos:
                # sus materias van al tramo del año en curso.
                ignorar = False
                continue
            abrir(etiqueta, "año" in etiqueta)
            continue

        if ignorar:
            continue
        lineas = _lineas(el)
        if not lineas:
            continue
        primera = _tramo(lineas[0])
        if primera and (len(lineas) > 1 or _tramo(texto)):
            abrir(primera, "año" in primera)
            lineas = lineas[1:]
        else:
            # Un <strong> inicial que no envuelve a todas las materias suele ser
            # un subtítulo de la lista ("Ciclo de Información"); no es materia.
            cabecera = el.find(["strong", "b"])
            if (cabecera is not None and "<br" not in str(cabecera)
                    and len(lineas) > 1
                    and limpiar_texto(cabecera.get_text(" ", strip=True)) == lineas[0]):
                lineas = lineas[1:]
        if not lineas or actual is None:
            continue
        for materia in lineas:
            if materia not in actual["materias"]:
                actual["materias"].append(materia)

    plan = [t for t in plan if t["materias"]]
    return plan or None


# ---------------------------------------------------------------------------
# Plan de estudio en PDF
# ---------------------------------------------------------------------------
# Varias carreras sólo publican la currícula dentro de un PDF ("Plan de
# estudios detallado"). Lo bajamos y lo leemos con `pdftotext -layout`; si la
# herramienta no está instalada o el PDF es una imagen (sin capa de texto),
# la carrera queda sin plan en lugar de inventarlo. Excepción: Psicología
# (PDF imagen) se transcribió a mano en data/um.json y se conserva vía
# `guardada.get("plan_estudio")`.
RE_PJ_ANIO = re.compile(rf"\b({ORDEN})\s+a[nñ]o\b", re.I)
RE_PJ_CODIGO = re.compile(r"\b([A-Za-z]{1,3}-?\d{1,4})\b")
RE_PJ_RUIDO = re.compile(
    r"(?i)(carga\s+horaria|asignatura|c[oó]digo|\bcorr\b|correlativ|cr[eé]dito|"
    r"r[eé]gimen|aprobaci[oó]n|total|requisito|para\s+poder|el\s+alumno|"
    r"promocion|no\s+prom|dedic|%|resoluci|adecuar|hay\s+que|"
    r"universidad|facultad de ciencias)")
RE_PJ_REGIMEN = re.compile(
    r"(?i)\s*\((?:a|s|sem|anual|promocional|no\s*prom\.?|r|ap|s\d+)\)\s*$")
RE_PJ_FRAG = re.compile(r"^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,.\-/()]{2,}$")
RE_PJ_COLUMNAS = re.compile(r"^(?:SEM|A|ANUAL|1ER|2DO|NO\s*PROM\.?|PROM\.?|-+)$", re.I)
RE_PJ_CONECTOR = re.compile(r"(?i)\b(de|del|la|las|los|y|e|en|con|para|al|a)$")
RE_PJ_FILA = re.compile(r"^\s*(?:\d{1,3}[.)]|\d{3,4}|[A-Za-z]{1,3}-?\d{1,4})\s")
RE_PJ_CICLO = re.compile(r"(?i)^ciclo\b")


def _pdf_plan_url(sopa, base):
    """Primer enlace a un PDF de plan de estudios de la página, o None."""
    respaldo = None
    for a in sopa.find_all("a", href=True):
        href = a["href"]
        if not href.lower().split("?")[0].endswith(".pdf"):
            continue
        if "plan" in a.get_text(" ", strip=True).lower():
            return urljoin(base, href)
        if respaldo is None and "plan" in href.lower():
            respaldo = urljoin(base, href)
    return respaldo


def _pj_texto(pdf_url):
    """Texto del PDF (pdftotext -layout) o None si no se puede obtener."""
    ruta = None
    try:
        resp = requests.get(pdf_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        if resp.status_code != 200 or not resp.content:
            return None
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(resp.content)
            ruta = tmp.name
        salida = subprocess.run(["pdftotext", "-layout", ruta, "-"],
                                capture_output=True, text=True, timeout=90)
        if salida.returncode != 0 or not salida.stdout.strip():
            return None
        return salida.stdout
    except (OSError, subprocess.SubprocessError, requests.RequestException):
        return None
    finally:
        if ruta and os.path.exists(ruta):
            os.remove(ruta)


def _pj_limpia(nombre):
    nombre = limpiar_texto(nombre).strip(" .")
    previo = None
    while previo != nombre:
        previo = nombre
        nombre = RE_PJ_REGIMEN.sub("", nombre).strip()
    return nombre.rstrip(" -")


def _pj_nombre(resto):
    partes = re.split(r"\s{2,}", resto.strip())
    return _pj_limpia(partes[0]) if partes and partes[0] else ""


def _pj_valida(nombre):
    return bool(nombre) and "%" not in nombre and not nombre.startswith(("°", "-"))


def _pj_generico(texto):
    lineas = texto.splitlines()
    plan, actual = [], None

    def nuevo(etiqueta):
        nonlocal actual
        actual = {"anio": etiqueta, "materias": []}
        plan.append(actual)

    i = 0
    while i < len(lineas):
        linea = lineas[i]
        i += 1
        if not linea.strip():
            continue
        anio = RE_PJ_ANIO.search(linea)
        if anio:
            nombre = f"{anio.group(1).capitalize()} año"
            if actual is None or actual["anio"] != nombre:
                nuevo(nombre)
            continue
        if actual is None or RE_PJ_RUIDO.search(linea):
            continue
        nombre = None
        m = re.match(r"^\s*\d{1,3}[.)]\s+([A-Za-zÁÉÍÓÚÑ][^ ].*)$", linea)
        if m:
            nombre = _pj_nombre(m.group(1))
        elif re.match(r"^\s*\d{3,4}\s+", linea):
            nombre = _pj_nombre(linea.split(None, 1)[1])
        else:
            mc = RE_PJ_CODIGO.search(linea)
            if mc:
                n = _pj_nombre(linea[mc.end():])
                if n and len(n) > 3:
                    nombre = n
        while nombre and RE_PJ_CONECTOR.search(nombre) and i < len(lineas):
            sig = lineas[i].strip()
            if not sig or RE_PJ_ANIO.search(sig) or RE_PJ_RUIDO.search(sig) or RE_PJ_FILA.match(sig):
                break
            nombre = _pj_limpia(nombre + " " + sig)
            i += 1
        if _pj_valida(nombre):
            actual["materias"].append(nombre)
    return [t for t in plan if t["materias"]] or None


def _pj_medicina(texto):
    tokens = []
    for linea in texto.splitlines():
        if not linea.strip():
            continue
        anio = RE_PJ_ANIO.search(linea)
        if anio:
            tokens.append(("anio", f"{anio.group(1).capitalize()} año"))
            continue
        m = re.match(r"^\s*(\d{1,3})\s+(\S.*)$", linea)
        if m:
            nombre = _pj_nombre(m.group(2))
            if not nombre or RE_PJ_COLUMNAS.match(nombre):
                nombre = None
            tokens.append(("fila", int(m.group(1)), nombre))
            continue
        if RE_PJ_RUIDO.search(linea) or RE_PJ_CICLO.match(linea.strip()):
            continue
        if RE_PJ_FRAG.match(linea.strip()) and len(linea.strip()) > 3:
            tokens.append(("frag", _pj_limpia(linea)))

    plan, actual = [], None
    for i, tok in enumerate(tokens):
        if tok[0] == "anio":
            actual = {"anio": tok[1], "materias": []}
            plan.append(actual)
        elif tok[0] == "fila" and actual is not None:
            nombre = tok[2]
            if nombre is None:
                frags = []
                for j in range(i - 1, -1, -1):
                    if tokens[j][0] == "fila":
                        break
                    if tokens[j][0] == "frag":
                        frags.insert(0, tokens[j][1])
                for j in range(i + 1, len(tokens)):
                    if tokens[j][0] == "fila":
                        break
                    if tokens[j][0] == "frag":
                        frags.append(tokens[j][1])
                nombre = _pj_limpia(" ".join(frags))
            if _pj_valida(nombre):
                actual["materias"].append(nombre)
    return [t for t in plan if t["materias"]] or None


def extraer_plan_pdf(pdf_url):
    texto = _pj_texto(pdf_url)
    if not texto:
        return None
    if "CARRERA DE MEDICINA" in texto:
        return _pj_medicina(texto)
    return _pj_generico(texto)


print("🛠️ Ajustando el radar de duración para la Universidad de Mendoza (UM)...\n")

carreras_viejas = carreras_guardadas("um.json")
um_data = {
    "id": 3,
    "nombre": "Universidad de Mendoza (UM)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4202017",
        "email": "informes@um.edu.ar",
        "direccion": "Boulogne Sur Mer 683, Ciudad"
    },
    "carreras": []
}

url_um = "https://um.edu.ar/carreras/"

try:
    req = requests.get(url_um, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')

    enlaces = sopa.find_all('a')
    id_global = 300
    contador = 0
    carreras_encontradas = set()

    for enlace in enlaces:
        href = enlace.get('href', '')
        nombre = enlace.text.strip()

        if "um.edu.ar/carreras/" in href and len(nombre) > 5 and nombre not in carreras_encontradas:
            if any(palabra in nombre.lower() for palabra in ["ingreso", "contacto", "aranceles", "inscripción"]):
                continue
            # El listado trae la paginación mezclada ("Entradas anteriores" > /page/2/).
            if not parece_carrera(nombre):
                continue

            carreras_encontradas.add(nombre)
            guardada = carreras_viejas.get(nombre)

            # Si ya tenía la duración guardada y además el plan, la respetamos
            if (guardada and es_duracion_real(guardada.get("duracion"))
                    and guardada.get("plan_estudio")):
                um_data["carreras"].append(guardada)
                print(f"  ⏭️ Recuperada: {nombre[:30]}...")
            else:
                print(f"  🔍 Escaneando a fondo: {nombre[:30]}...")
                duracion_texto = "A confirmar"
                facultad_texto = "UM"
                plan = None
                fuente_plan = None

                try:
                    time.sleep(0.5)
                    resp_det = requests.get(href, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(resp_det.text, 'html.parser')

                    # 🎯 RADAR DE DURACIÓN (Busca por texto general usando Regex)
                    texto_pagina = sopa_det.get_text()
                    # Busca patrones como "Duración: 4 años" o "Duración 5 años"
                    match_duracion = re.search(r'duraci[óo]n\s*[:\-]?\s*([0-9]+\s*(?:año|años|semestre|semestres))', texto_pagina, re.IGNORECASE)

                    if match_duracion:
                        duracion_texto = match_duracion.group(1).capitalize()
                    else:
                        # Plan de rescate secundario buscando dentro de los párrafos/strong
                        for strong in sopa_det.find_all(['strong', 'b']):
                            if "duración" in strong.text.lower():
                                parent_text = strong.parent.get_text()
                                match_p = re.search(r'duraci[óo]n\s*[:\-]?\s*([0-9]+\s*(?:año|años))', parent_text, re.IGNORECASE)
                                if match_p:
                                    duracion_texto = match_p.group(1).capitalize()
                                    break

                    # Extracción de sedes
                    sedes = []
                    iconos_ubicacion = sopa_det.find_all('i', class_='fa-map-marker-alt')
                    for icono in iconos_ubicacion:
                        texto_sede = icono.next_sibling
                        if texto_sede and isinstance(texto_sede, str):
                            sede_limpia = texto_sede.strip(" \xa0\n\r\t")
                            if sede_limpia and sede_limpia not in sedes:
                                sedes.append(sede_limpia)
                    if sedes:
                        facultad_texto = "UM - " + " / ".join(sedes)

                    # Plan de estudio (pestaña "Plan de Estudio" / "Plan de Estudios")
                    plan = extraer_plan(sopa_det)
                    if plan:
                        fuente_plan = href
                    else:
                        # Si la web no lo publica como texto, probamos con el PDF.
                        pdf_url = _pdf_plan_url(sopa_det, href)
                        if pdf_url:
                            plan = extraer_plan_pdf(pdf_url)
                            if plan:
                                fuente_plan = pdf_url
                    if not plan:
                        # Último recurso: tecnicaturas que listan las materias en
                        # h4 dentro del tab "Régimen de estudios" (Des. Software).
                        plan = _plan_régimen_estudios(sopa_det)
                        if plan:
                            fuente_plan = href

                except Exception:
                    pass

                nueva = {
                    "id": id_global,
                    "nombre_carrera": nombre,
                    "categoria": "Grado / Carrera",
                    "duracion": mejor_duracion(duracion_texto, guardada),
                    "modalidad": "Presencial",
                    "facultad": facultad_texto,
                    "link_oficial": href
                }
                # Si la web no publica el plan como texto (sólo PDF) pero ya
                # teníamos uno guardado, se conserva el viejo.
                plan = plan or (guardada or {}).get("plan_estudio")
                if plan:
                    nueva["plan_estudio"] = plan
                    nueva["plan_fuente"] = (fuente_plan
                                            or (guardada or {}).get("plan_fuente")
                                            or href)
                um_data["carreras"].append(nueva)
            id_global += 1
            contador += 1

    print(f"\n✅ ¡Listo! Se procesaron las {contador} carreras de la UM con sus duraciones.")

except Exception as e:
    print(f"⚠️ Error general en UM: {e}")

base_um = {"instituciones": [um_data]}
guardar_json(base_um, "um.json")
print("🎉 Archivo 'um.json' actualizado con el radar de duración.")
