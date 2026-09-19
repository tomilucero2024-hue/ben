"""Extracción de planes de estudio desde los PDFs institucionales.

Varios IES publican el plan como un flyer diseñado (dos columnas: primer y
segundo año a la izquierda, tercero y cuarto a la derecha), con cada materia en
una viñeta. `pdftotext` en modo texto plano lo devuelve desordenado, así que acá
se leen las coordenadas de cada palabra con `pdftotext -bbox` y se reconstruye
cada columna por separado.

Si el PDF no tiene texto (viene escaneado), no hay nada que extraer y devuelve
None: preferimos dejar la carrera sin plan antes que inventarlo.
"""

import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import requests

_NS = "{http://www.w3.org/1999/xhtml}"
_RE_ANIO = re.compile(r"^(primer|segundo|tercer|cuarto|quinto|sexto)\s+a[ñn]o\b", re.I)
_MAPA_ANIO = {"primer": "1", "segundo": "2", "tercer": "3",
              "cuarto": "4", "quinto": "5", "sexto": "6"}
# Pie de página y logos que el flyer imprime al final de cada columna.
_RE_PIE = re.compile(r"ISFD|Powered by|RIVADAVIA|9-0\d\d|MENDOZA|Escuela Suite", re.I)


def _ancho_y_palabras(ruta_pdf):
    """Ancho de página y palabras con (xMin, yMin, xMax, texto)."""
    with tempfile.TemporaryDirectory() as tmp:
        salida = os.path.join(tmp, "bbox.html")
        subprocess.run(["pdftotext", "-bbox", ruta_pdf, salida],
                       check=True, timeout=120,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        root = ET.parse(salida).getroot()
    paginas = list(root.iter(_NS + "page"))
    ancho = float(paginas[0].get("width")) if paginas else 595.0
    palabras = [
        (float(w.get("xMin")), float(w.get("yMin")), float(w.get("xMax")), w.text or "")
        for w in root.iter(_NS + "word")
    ]
    return ancho, palabras


def _lineas(palabras, tolerancia=4):
    """Agrupa palabras en renglones por cercanía vertical."""
    palabras = sorted(palabras, key=lambda w: (w[1], w[0]))
    lineas = []
    for palabra in palabras:
        if lineas and abs(palabra[1] - lineas[-1][0][1]) < tolerancia:
            lineas[-1].append(palabra)
        else:
            lineas.append([palabra])
    return lineas


def plan_desde_pdf(datos_pdf):
    """Interpreta el flyer a dos columnas y devuelve el plan, o None."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(datos_pdf)
        ruta = tmp.name
    try:
        ancho, palabras = _ancho_y_palabras(ruta)
    except Exception:
        return None
    finally:
        os.unlink(ruta)
    if not palabras:
        return None

    mitad = ancho * 0.5
    columnas = {"L": [], "R": []}
    for linea in _lineas(palabras):
        for clave, costado in (("L", [w for w in linea if w[2] <= mitad]),
                               ("R", [w for w in linea if w[2] > mitad])):
            if costado:
                costado.sort(key=lambda w: w[0])
                columnas[clave].append((costado[0][1], " ".join(w[3] for w in costado)))

    plan = []
    for clave in ("L", "R"):
        actual = None
        for _, texto in sorted(columnas[clave]):
            coincidencia = _RE_ANIO.match(texto)
            if coincidencia:
                actual = {"anio": _MAPA_ANIO[coincidencia.group(1).lower()] + "º año",
                          "materias": []}
                plan.append(actual)
                continue
            if _RE_PIE.search(texto):
                continue
            if actual is None:
                continue
            if texto.lstrip().startswith("•"):
                materia = texto.lstrip("• ").strip()
                if materia:
                    actual["materias"].append(materia)
            elif actual["materias"]:
                actual["materias"][-1] += " " + texto
    return [tramo for tramo in plan if tramo["materias"]] or None


def plan_desde_url_pdf(url):
    """Descarga un PDF y devuelve su plan, o None si falla."""
    try:
        respuesta = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=60)
        respuesta.raise_for_status()
        return plan_desde_pdf(respuesta.content)
    except Exception:
        return None


def enlaces_pdf(sopa):
    """Lista [(texto, href)] de los PDFs enlazados en una página."""
    enlaces = []
    for a in sopa.find_all("a", href=True):
        href = a["href"]
        if href.lower().split("?")[0].endswith(".pdf"):
            enlaces.append((a.get_text(" ", strip=True), href))
    return enlaces


def primer_pdf_de_plan(sopa):
    """El enlace al PDF del plan: prioriza los que dicen 'plan' en el texto."""
    enlaces = enlaces_pdf(sopa)
    for texto, href in enlaces:
        if re.search(r"plan", texto, re.I):
            return href
    return enlaces[0][1] if enlaces else None
