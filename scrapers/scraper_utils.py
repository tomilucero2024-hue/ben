"""Funciones compartidas por los scrapers de BEN.

Cada scraper mantiene su lógica propia de parseo (cada web es distinta), pero
todo lo que se repetía —pedir una página, limpiar el texto scrapeado, recuperar
lo ya guardado y escribir el JSON— vive acá.
"""

import json
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup


def configurar_consola():
    """Deja stdout/stderr en UTF-8.

    Los mensajes de los scripts usan emojis (✅, ⚠️) y la consola de Windows
    arranca en cp1252: al imprimirlos el script muere con UnicodeEncodeError
    DESPUÉS de haber escrito el JSON, y encima devuelve código 1, que corta
    cualquier encadenado con subprocess(check=True). Con errors='replace' el
    peor caso es un '?' en pantalla, nunca una corrida abortada.
    """
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
        except (AttributeError, OSError):
            pass


configurar_consola()

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"
DIR_FUENTES = Path(__file__).resolve().parent / "fuentes"

CABECERAS = {"User-Agent": "Mozilla/5.0"}
ESPERA = 15

# Etiquetas que las webs suelen dejar pegadas al valor, por ejemplo
# "DURACIÓN\t\t\n 5 años". Solo se recortan si van seguidas de dos puntos,
# tabulación o salto de línea: así no se rompen nombres legítimos que empiezan
# con esas palabras, como "Carrera de Medicina".
ETIQUETAS_PEGADAS = re.compile(
    r"(?i)^\s*(duraci[oó]n|modalidad|t[ií]tulo|titulaci[oó]n|carrera|nivel|turno)\s*[:\t\r\n]+\s*"
)


def limpiar_texto(valor):
    """Normaliza un texto scrapeado: sin etiquetas pegadas, tabs ni espacios de más."""
    if not isinstance(valor, str):
        return valor
    texto = valor.replace("\xa0", " ")
    texto = ETIQUETAS_PEGADAS.sub("", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def limpiar_estructura(dato):
    """Aplica limpiar_texto() a todos los textos de un dict/lista, sin tocar las claves."""
    if isinstance(dato, dict):
        return {k: limpiar_estructura(v) for k, v in dato.items()}
    if isinstance(dato, list):
        return [limpiar_estructura(v) for v in dato]
    return limpiar_texto(dato)


def pedir_sopa(url, cabeceras=None, espera=ESPERA, parser="html.parser"):
    """Descarga una página y devuelve su BeautifulSoup, o None si falla."""
    try:
        respuesta = requests.get(url, headers=cabeceras or CABECERAS, timeout=espera)
        respuesta.raise_for_status()
        return BeautifulSoup(respuesta.text, parser)
    except Exception as error:
        print(f"⚠️ No se pudo leer {url}: {error}")
        return None


def carreras_guardadas(nombre_archivo):
    """Devuelve las carreras ya guardadas, indexadas por nombre, para no perder datos."""
    ruta = DIR_DATOS / nombre_archivo
    if not os.path.exists(ruta):
        return {}
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            datos = json.load(f)
        return {
            c["nombre_carrera"]: c
            for institucion in datos.get("instituciones", [])
            for c in institucion.get("carreras", [])
            if c.get("nombre_carrera")
        }
    except (json.JSONDecodeError, OSError, KeyError):
        return {}


# Un listado de carreras casi siempre trae, mezclados con las carreras, enlaces
# de paginación y avisos sueltos. Ya se colaron dos al catálogo: "Entradas
# anteriores" (era el link a la página 2 de la UM) y "Fecha de Próxima
# Inscripción: Jueves 14 de mayo…" (un aviso en el listado de la UDA). Publicados
# como carrera quedan en la grilla, en el buscador y hasta con perfil vocacional.
_RUIDO_DE_LISTADO = re.compile(
    r"(?i)(^\s*[\"“']|fecha\s+de|pr[oó]xima\s+inscripci|inscripci[oó]n\s*:|\d{1,2}\s*:\s*\d{2}\s*hs"
    r"|entradas?\s+(anteriores|siguientes)|p[aá]gina\s+siguiente|ver\s+m[aá]s|leer\s+m[aá]s"
    r"|^\s*(siguiente|anterior|inicio|home|contacto|novedades)\s*$)"
)


def parece_carrera(nombre):
    """False si el texto es ruido del listado y no el nombre de una carrera."""
    limpio = limpiar_texto(nombre)
    if not limpio or len(limpio) < 5:
        return False
    return not _RUIDO_DE_LISTADO.search(limpio)


def carreras_por_link(nombre_archivo):
    """Igual que carreras_guardadas() pero indexando por link_oficial.

    El nombre no sirve de clave: varios scrapers arman uno provisorio desde el
    slug de la URL ("Contador Publico") y guardan el del <h1> ("Contador
    Público"), así que la búsqueda en la memoria nunca acertaba. Como el scraper
    reescribe el archivo entero en cada corrida, eso significaba que una corrida
    con la web caída o lenta borraba las duraciones ya conseguidas. El link es
    estable y es el mismo dato con el que se entra a la ficha.
    """
    ruta = DIR_DATOS / nombre_archivo
    if not os.path.exists(ruta):
        return {}
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            datos = json.load(f)
        return {
            c["link_oficial"]: c
            for institucion in datos.get("instituciones", [])
            for c in institucion.get("carreras", [])
            if c.get("link_oficial")
        }
    except (json.JSONDecodeError, OSError, KeyError):
        return {}


SIN_DURACION = ("A confirmar", "Verificar en web oficial", "Verificar en página oficial",
                "Consultar en la web", "No especificada", "", None)


def es_duracion_real(valor):
    """True si el valor es una duración de verdad y no un 'no sabemos'."""
    return valor not in SIN_DURACION


def mejor_duracion(nueva, guardada):
    """Elige entre lo recién scrapeado y lo que ya había.

    Regla: un dato bueno nunca se pisa con un placeholder. Si esta corrida no
    consiguió la duración (la web cambió, se cayó, cortó por rate limit), se
    conserva la que ya estaba en el JSON.
    """
    if es_duracion_real(nueva):
        return nueva
    if guardada and es_duracion_real(guardada.get("duracion")):
        return guardada["duracion"]
    return nueva


def guardar_json(datos, nombre_archivo, mensaje=None):
    """Limpia todos los textos y guarda el JSON en data/ con el formato de siempre.

    No imprime nada por defecto: cada scraper conserva su propio mensaje final.
    """
    ruta = DIR_DATOS / nombre_archivo
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(limpiar_estructura(datos), f, ensure_ascii=False, indent=4)
    if mensaje:
        print(mensaje)


def guardar_institucion(institucion, nombre_archivo, mensaje=None):
    """Envuelve una institución en la estructura {"instituciones": [...]} y la guarda."""
    guardar_json({"instituciones": [institucion]}, nombre_archivo, mensaje)


# ---------------------------------------------------------------------------
# Duración
# ---------------------------------------------------------------------------
#
# Cada scraper tenía su propio regex para sacar la duración de una ficha, y los
# tres que lo intentaban fallaban por motivos distintos: uno exigía "Duración:"
# con dos puntos (la web pasó a escribirlo en prosa), otro no contemplaba los
# meses ("DURACIÓN 18 meses" no matcheaba), y el tercero ni lo intentaba. El
# resultado eran 93 carreras publicadas como "Verificar en web oficial".
#
# Acá va una sola implementación para los cuatro.

_NUMEROS_ESCRITOS = {
    "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
    "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12,
}
_ORDINALES_ANIO = {
    "1er": 1, "1ro": 1, "1°": 1, "primer": 1, "primero": 1,
    "2do": 2, "2°": 2, "segundo": 2,
    "3er": 3, "3ro": 3, "3°": 3, "tercer": 3, "tercero": 3,
    "4to": 4, "4°": 4, "cuarto": 4,
    "5to": 5, "5°": 5, "quinto": 5,
    "6to": 6, "6°": 6, "sexto": 6,
    "7mo": 7, "7°": 7, "septimo": 7,
}

_NUM = r"(\d+(?:[.,]\d+)?|" + "|".join(sorted(_NUMEROS_ESCRITOS, key=len, reverse=True)) + r")"
_MEDIO = r"(?:\s*y)?\s*(?:medio|media|1/2)"
# Orden: de la unidad más confiable a la menos.
_UNIDADES = [
    (r"a[nñ]os?", 1.0),
    (r"cuatrimestres?", 1 / 3),
    (r"semestres?", 1 / 2),
    (r"mes(?:es)?", 1 / 12),
]


def _normalizar(texto):
    return re.sub(r"\s+", " ", (texto or "").replace("\xa0", " ")).strip()


def _formatear_anios(anios):
    """Pasa un valor en años a la etiqueta que se guarda en el JSON."""
    if anios <= 0:
        return None
    if anios < 1:
        meses = max(1, round(anios * 12))
        return f"{meses} {'mes' if meses == 1 else 'meses'}"
    enteros = int(anios)
    resto = anios - enteros
    base = f"{enteros} {'año' if enteros == 1 else 'años'}"
    if resto < 0.01:
        return base
    if abs(resto - 0.5) < 0.01:
        return f"{base} y medio"
    meses = round(resto * 12)
    return f"{base} y {meses} {'mes' if meses == 1 else 'meses'}" if meses else base


def _buscar_valor(fragmento):
    """Devuelve (años, etiqueta) de lo que menciona un fragmento, o None.

    La etiqueta respeta la unidad en la que lo publica la institución: si la
    ficha de la UDA dice "18 meses", en el JSON queda "18 meses" y no "1 año y
    medio". Son lo mismo, pero el JSON es el dato y conviene que se parezca a la
    fuente; convertirlo a años es cosa de la vista (js/util.js lo hace).
    """
    for patron, factor in _UNIDADES:
        m = re.search(rf"{_NUM}({_MEDIO})?\s*(?:{patron})\b({_MEDIO})?", fragmento, re.IGNORECASE)
        if not m:
            continue
        bruto = m.group(1).lower()
        valor = _NUMEROS_ESCRITOS.get(bruto)
        if valor is None:
            try:
                valor = float(bruto.replace(",", "."))
            except ValueError:
                continue
        if m.group(2) or m.group(3):
            valor += 0.5
        anios = valor * factor
        if factor == 1 / 12 and float(valor).is_integer():
            entero = int(valor)
            return anios, f"{entero} {'mes' if entero == 1 else 'meses'}"
        return anios, _formatear_anios(anios)
    return None


def extraer_duracion(texto, ventana=140):
    """Saca la duración del texto de una ficha de carrera.

    Devuelve una etiqueta corta ("5 años", "18 meses", "2 años y medio") o None
    si no encuentra nada creíble. Nunca inventa: preferimos que el scraper deje
    el "a confirmar" antes que publicar una duración inventada.

    Busca primero al lado de la palabra "duración" —da igual si viene con dos
    puntos, con guion o sin nada, como "DURACIÓN 18 meses"— porque ahí el número
    es inequívoco. Solo si no aparece cae a frases del tipo "la carrera se cursa
    en cinco años". Un número suelto NO se toma: en estas páginas suele ser la
    carga horaria o el año de inicio.
    """
    plano = _normalizar(texto)
    if not plano:
        return None

    for m in re.finditer(r"duraci[oó]n", plano, re.IGNORECASE):
        hallado = _buscar_valor(plano[m.end():m.end() + ventana])
        if hallado:
            return hallado[1]

    respaldo = re.compile(
        r"(?:la\s+)?(?:carrera|tecnicatura|licenciatura|profesorado|ciclo|plan|cursad[ao])"
        r"[^.]{0,60}?(?:dura|se\s+cursa\s+en|tiene\s+una\s+duraci[oó]n\s+de|es\s+de)\s+([^.]{0,60})",
        re.IGNORECASE,
    )
    for m in respaldo.finditer(plano):
        hallado = _buscar_valor(m.group(1))
        if hallado:
            return hallado[1]
    return None


# ---------------------------------------------------------------------------
# Plan de estudios (webs "Escuela Suite" de los IES del INFd)
# ---------------------------------------------------------------------------
#
# Los IES de la plataforma *-infd.mendoza.edu.ar publican la currícula con el
# mismo esqueleto —un título "Plan de estudios", un subtítulo por año y las
# materias debajo— pero cada carrera lo maqueta distinto: los años vienen en
# <h3>, en <p> o con la carga horaria pegada ("Primer Año – 870 hs cátedra");
# las materias, en <ul>, en <ol> o dentro de un único <p> con <br>. Por eso el
# extractor no se ata a una etiqueta: camina lo que sigue al título, reconoce
# los años por el texto y levanta las materias de los tres formatos.

RE_ANIO_PLAN = re.compile(
    r"^(primer|segundo|tercer|cuarto|quinto|sexto|\d{1,2})\s*(?:er|do|to|mo|ro|[.°º])*\s*a[ñn]o\b",
    re.I,
)
_MAPA_ANIO_PLAN = {"primer": "1", "segundo": "2", "tercer": "3",
                   "cuarto": "4", "quinto": "5", "sexto": "6"}
_RE_NUMERO_MATERIA = re.compile(r"^\s*\d{1,3}\s*[\.\-)]\s*")
_RE_FIN_DE_PLAN = re.compile(
    r"(?i)plan\s+d?e?\s*\d{4}.*resoluci|resoluci[oó]n\s+aprobatoria|^\s*enlace\s+de\s+descarga"
)


def lineas_por_br(raiz):
    """Parte un nodo en líneas: cada <br> (aunque esté anidado) corta una materia."""
    lineas = [""]

    def recorrer(nodo):
        for hijo in nodo.children:
            nombre = getattr(hijo, "name", None)
            if nombre == "br":
                lineas.append("")
            elif nombre:
                recorrer(hijo)
            else:
                lineas[-1] += str(hijo)

    recorrer(raiz)
    return [re.sub(r"\s+", " ", linea).strip() for linea in lineas if linea.strip()]


def _limpiar_materia(texto):
    """Saca el número de orden ("01.", "31-") con el que la web lista cada materia."""
    texto = re.sub(r"\s+", " ", texto.replace("\xa0", " ")).strip(" .-–|")
    return _RE_NUMERO_MATERIA.sub("", texto).strip()


def _materias_de(elemento):
    if elemento.name in ("ul", "ol"):
        lineas = []
        for item in elemento.find_all("li", recursive=False):
            lineas.extend(lineas_por_br(item))
    elif elemento.name == "p":
        lineas = lineas_por_br(elemento)
    else:
        return []
    return [m for m in (_limpiar_materia(linea) for linea in lineas) if m]


def _numero_de_anio_plan(texto):
    """1, 2… o "Primer" -> número de año, o None."""
    coincidencia = RE_ANIO_PLAN.match(texto)
    if not coincidencia:
        return None
    bruto = coincidencia.group(1).lower()
    return bruto if bruto.isdigit() else _MAPA_ANIO_PLAN.get(bruto)


def extraer_plan_anual(sopa):
    """Plan de estudios de las webs del INFd: años sueltos y materias debajo.

    Devuelve [{"anio": "1º año", "materias": [...]}, ...] o None si no encuentra
    el título del plan. No inventa: sin título no hay plan.
    """
    inicio = None
    for elemento in sopa.find_all(["h1", "h2", "h3", "h4", "h5", "p", "strong", "b"]):
        if elemento.find_parent("nav"):
            continue
        clases = " ".join(elemento.get("class") or []).lower()
        if "menu" in clases or "nav" in clases:
            continue
        if re.fullmatch(r"plan de estudios?\.?", elemento.get_text(" ", strip=True), re.I):
            inicio = elemento
            break
    if inicio is None:
        return None

    plan = []
    actual = None
    for elemento in inicio.find_all_next(["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol"]):
        texto = re.sub(r"\s+", " ", elemento.get_text(" ", strip=True))
        if not texto:
            continue
        numero = _numero_de_anio_plan(texto)
        if numero:
            actual = {"anio": numero + "º año", "materias": []}
            plan.append(actual)
            continue
        if _RE_FIN_DE_PLAN.search(texto):
            if actual is not None:
                break
            continue
        if elemento.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            if actual is not None:
                break
            continue
        if elemento.name in ("ul", "ol", "p") and actual is not None:
            for materia in _materias_de(elemento):
                if not RE_ANIO_PLAN.match(materia):
                    actual["materias"].append(materia)

    return [tramo for tramo in plan if tramo["materias"]] or None


def extraer_plan_en_bloque(sopa):
    """Plan escrito dentro de un único bloque, separado por <br>.

    Otra maqueta del INFd: la currícula entera va en una misma celda/div, con
    los años en negrita y las materias cortadas por <br> ("PLAN DE ESTUDIO / PRIMER
    AÑO: / materia / materia / SEGUNDO AÑO: …"). Acá se busca el bloque que más
    años reconozca y se parsea renglón por renglón.
    """
    mejor = None
    mejor_anios = 0
    for contenedor in sopa.find_all(["td", "section", "article", "div", "p"]):
        if contenedor.find(["td", "section", "article", "div"]):
            continue
        if not re.search(r"plan de estudios?", contenedor.get_text(" ", strip=True), re.I):
            continue
        lineas = lineas_por_br(contenedor)
        anios = sum(1 for linea in lineas if _numero_de_anio_plan(linea))
        if anios > mejor_anios:
            mejor_anios = anios
            mejor = lineas
    if mejor is None or mejor_anios < 1:
        return None

    plan = []
    actual = None
    for linea in mejor:
        numero = _numero_de_anio_plan(linea)
        if numero:
            actual = {"anio": numero + "º año", "materias": []}
            plan.append(actual)
            continue
        if re.fullmatch(r"plan de estudios?:?", linea, re.I):
            continue
        if actual is not None:
            materia = _limpiar_materia(linea)
            if materia:
                actual["materias"].append(materia)
    return [tramo for tramo in plan if tramo["materias"]] or None


def duracion_por_plan(texto):
    """Deduce la duración contando los años del plan de estudios.

    Para las fichas que no dicen la duración en ninguna parte pero publican la
    currícula completa separada por año ("1er año … 5to año"), que es el caso de
    las landings de la UMaza. El último año que aparece es la duración.
    """
    plano = _normalizar(texto).lower()
    anios = set()
    llaves = "|".join(sorted((re.escape(k) for k in _ORDINALES_ANIO), key=len, reverse=True))
    for m in re.finditer(rf"\b({llaves})\s+a[nñ]o\b", plano):
        anios.add(_ORDINALES_ANIO[m.group(1)])
    if not anios:
        return None
    # Los años tienen que venir en cadena desde 1: si una página menciona
    # "1er año" y "5to año" pero ninguno del medio, no es un plan de estudios.
    tope = max(anios)
    if set(range(1, tope + 1)) - anios:
        return None
    return _formatear_anios(float(tope))
