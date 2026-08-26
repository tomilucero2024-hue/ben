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
