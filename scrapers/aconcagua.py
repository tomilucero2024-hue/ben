import json
import os
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from scraper_utils import (carreras_por_link, es_duracion_real, extraer_duracion,
                           guardar_json, limpiar_texto, mejor_duracion,
                           parece_carrera)

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


# ---------------------------------------------------------------------------
# Plan de estudio
# ---------------------------------------------------------------------------
# Las fichas publican la currícula en la pestaña "PLAN DE ESTUDIO" como
# acordeones SP Page Builder: un .sppb-panel por año ("PRIMER AÑO"…) más
# "FORMACIÓN GENERAL Y COMPLEMENTARIA" y "OTROS REQUISITOS"; cada panel trae
# <p> de período ("PRIMER SEMESTRE", "ASIGNATURA ANUAL"…) y listas <ol>.
# La ficha duplica el bloque para mobile: parseamos solo la primera pestaña.
RE_ANIO_UDA = re.compile(
    r"\b(primer|segundo|tercer|cuarto|quinto|sexto|s[eé]ptimo)\s+a[nñ]o\b", re.I)
RE_PERIODO_UDA = re.compile(
    r"^(primer|segundo|tercer|cuarto)\s+(semestre|cuatrimestre)$", re.I)
RE_ANUAL_UDA = re.compile(r"^(asignaturas?\s+)?anual(es)?$", re.I)
RE_SEMESTRAL_UDA = re.compile(r"^asignaturas?\s+semestral(es)?$", re.I)


def _titulo_panel_uda(texto):
    """Título del acordeón normalizado, o None si no aporta nada."""
    t = limpiar_texto(texto)
    if not t:
        return None
    m = RE_ANIO_UDA.search(t)
    if m:
        return f"{m.group(1).capitalize()} año"
    if t.isupper() and len(t) > 4:
        t = t[0] + t[1:].lower()
    return t


def _periodo_uda(texto):
    """Etiqueta de período normalizada, o None."""
    t = limpiar_texto(texto).rstrip(" :")
    if not t:
        return None
    m = RE_PERIODO_UDA.match(t)
    if m:
        return f"{m.group(1).capitalize()} {m.group(2).lower()}"
    if RE_ANUAL_UDA.match(t):
        return "Anual"
    if RE_SEMESTRAL_UDA.match(t):
        return "Semestrales"
    return None


RE_ITEM_UDA = re.compile(r"^(\d{1,3})[.\-]?\s+(\S.*)$")
# Dentro de un mismo <p> pueden convivir el período y varias materias
# ("PRIMER CUATRIMESTRE 1. Matemática 2. Programación…" o "01- Brief &
# Insight 02- Diseño…"): se corta por marcador de período y por número de
# ítem. El [A-Z] va case-sensitive ((?-i:…)) para no cortar ante
# "22 materias" (con re.I, [A-Z] matchea minúsculas y partía los
# encabezados en pedazos).
RE_CORTE_UDA = re.compile(
    r"\s*((?:primer|segundo|tercer|cuarto)\s+(?:cuatrimestre|semestre)|anual)\s*"
    r"|\s+(?=\d{1,3}(?:[.\-]\s*|\s+(?-i:[A-ZÁÉÍÓÚÑ])))", re.I)
RESTO_P_UDA = {"asignatura", "asignaturas"}
# Encabezados de resumen ("…22 materias (2.036hs reloj)… CICLO BÁSICO"):
# nunca son materias aunque abran un párrafo con ítems numerados.
RE_BASURA_UDA = re.compile(
    r"(?i)(materias|hs\.?\s*reloj|ciclo|t[ií]tulo|correlativ|nota\b|r[eé]gimen)")
# Cola pegada al ítem: hito de título, llamada de nota ("(*) …") o el docente
# entre paréntesis que algunas fichas agregan ("… (Mgter. Leandro Carbone)").
RE_COLA_UDA = re.compile(
    r"\s*(?:t[ií]tulo\s+de\b.*|\(\*+\)\s*.*"
    r"|\(\s*(?:mgter\.?|dr\.?|dra\.?|lic\.?|esp\.?|ing\.?|arq\.?|prof\.?)"
    r"[^()]*)\)\s*$", re.I)


def _nombre_item_uda(texto):
    return RE_COLA_UDA.sub("", limpiar_texto(texto)).strip().rstrip("*").strip()


def extraer_plan_uda(sopa):
    tab = None
    for cand in sopa.select("[id^=sppb-tab-]"):
        if limpiar_texto(cand.get_text(" ", strip=True)).lower().startswith("plan de estudio"):
            tab = cand
            break
    if tab is None:
        # Algunas fichas (p. ej. la Maestría en Ejercicio Físico y Salud) no
        # encabezan la pestaña con "plan de estudio": arrancan directo con el
        # primer acordeón ("PRIMER AÑO"). Elegimos la pestaña con más paneles
        # que titulen año (desktop y mobile duplican el bloque, tomamos el 1º).
        mejor_anios, mejor = -1, None
        for cand in sopa.select("[id^=sppb-tab-]"):
            anios = 0
            for titulo in cand.select(".sppb-panel .sppb-panel-title"):
                base = _titulo_panel_uda(limpiar_texto(titulo.get_text(" ", strip=True)))
                if base and "año" in base.lower():
                    anios += 1
            if anios > mejor_anios:
                mejor_anios, mejor = anios, cand
        tab = mejor
    if tab is None:
        return None
    plan = []
    actual = None

    def agregar(etiqueta, items):
        nonlocal actual
        if actual is None or actual["anio"] != etiqueta:
            actual = {"anio": etiqueta, "materias": []}
            plan.append(actual)
        for materia in items:
            if materia and materia not in actual["materias"]:
                actual["materias"].append(materia)

    for panel in tab.select(".sppb-panel"):
        titulo_el = panel.select_one("span.sppb-panel-title")
        if titulo_el is None:
            continue
        base = _titulo_panel_uda(titulo_el.get_text(" ", strip=True))
        if not base:
            continue
        es_anio = "año" in base.lower()
        periodo = None
        for el in panel.find_all(["p", "ol", "ul"]):
            texto = limpiar_texto(el.get_text(" ", strip=True))
            if el.name == "p":
                per = _periodo_uda(texto)
                if per is not None:
                    periodo = per
                    continue
                if not texto:
                    continue
                partes = [p for p in RE_CORTE_UDA.split(texto) if p and p.strip()]
                numerados = [p for p in partes if RE_ITEM_UDA.match(p.strip())]
                for idx, parte in enumerate(partes):
                    parte = parte.strip()
                    per2 = _periodo_uda(parte)
                    if per2 is not None:
                        periodo = per2
                        continue
                    m = RE_ITEM_UDA.match(parte)
                    if m:
                        nombre = _nombre_item_uda(m.group(2))
                    elif (idx == 0 and numerados and len(parte) >= 3
                            and parte.lower() not in RESTO_P_UDA
                            and not RE_BASURA_UDA.search(parte)):
                        # Primer ítem sin número ("Marketing 2. Análisis…").
                        nombre = _nombre_item_uda(parte)
                    else:
                        # Encabezados, notas y pies ("TITULO INTERMEDIO…").
                        continue
                    if not nombre:
                        continue
                    etiqueta = f"{base} — {periodo}" if (es_anio and periodo) else base
                    agregar(etiqueta, [nombre])
                continue
            items = [_nombre_item_uda(li.get_text(" ", strip=True))
                     for li in el.find_all("li")]
            etiqueta = f"{base} — {periodo}" if (es_anio and periodo) else base
            agregar(etiqueta, [x for x in items if x])
    plan = [t for t in plan if t["materias"]]
    return plan or None


print("🛠️ Encendiendo el escáner V6 para la Universidad del Aconcagua (UDA)...\n")

archivo_uda = DIR_DATOS / "uda.json"
# Memoria del taller, indexada por link: el nombre que trae el listado puede
# cambiar de una corrida a otra (mayúsculas, tildes, un "a Distancia" agregado)
# y la URL no. Como el scraper reescribe el archivo entero, una clave que no
# acierta significa perder las duraciones ya conseguidas.
carreras_viejas = carreras_por_link("uda.json")

uda_data = {
    "id": 6,
    "nombre": "Universidad del Aconcagua (UDA)",
    "nivel": "universidad",
    "gestion": "privada", # 👈 Etiqueta naranja asegurada
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "5201620",
        "email": "informes@uda.edu.ar",
        "direccion": "Catamarca 147, Ciudad"
    },
    "carreras": []
}

url_estudios = "https://www.uda.edu.ar/index.php/estudios"
id_global = 600
contador = 0
carreras_procesadas = set() # Filtro de aire para no chupar duplicados

try:
    print("📍 Escaneando el mapa principal en busca de Facultades...")
    req = requests.get(url_estudios, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # 1. Recolectar links de facultades (como los de tu primera captura)
    links_facultades = set()
    for a in sopa.find_all('a'):
        href = a.get('href', '')
        if "institucional-" in href or "facultad" in href or "oferta-educativa" in href:
            if not href.startswith("http"):
                href = "https://www.uda.edu.ar" + href
            links_facultades.add(href)
            
    print(f"✅ Se encontraron {len(links_facultades)} pabellones/facultades. Entrando a revisar...")
    
    # 2. Entrar a cada facultad y buscar las carreras
    for url_facu in links_facultades:
        try:
            time.sleep(0.5) # Ralentí para cuidar el servidor
            req_f = requests.get(url_facu, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            sopa_f = BeautifulSoup(req_f.text, 'html.parser')
            
            for a in sopa_f.find_all('a'):
                href_c = a.get('href', '')
                nombre_carrera = a.text.strip()
                
                # Filtramos por las URLs que mostraste en las capturas 2 y 3
                # Los ciclos de complementación estaban fuera del filtro, así que
                # sus 15 carreras nunca se destripaban y quedaban con el "A
                # confirmar" del arranque — aunque su ficha publica la duración
                # igual de clara que las de grado ("DURACIÓN 18 meses").
                RUTAS_DE_CARRERA = ("carreras-de-grado", "carreras-de-pregrado", "ciclos-de-complementacion")
                # parece_carrera() saca los avisos que cuelgan del mismo listado
                # (en el de ciclos había un "Fecha de Próxima Inscripción: Jueves
                # 14 de mayo…" que entró al catálogo como si fuera una carrera).
                if any(r in href_c for r in RUTAS_DE_CARRERA) and parece_carrera(nombre_carrera):
                    if not href_c.startswith("http"):
                        link_real = "https://www.uda.edu.ar" + href_c
                    else:
                        link_real = href_c
                        
                    if nombre_carrera in carreras_procesadas:
                        continue
                    carreras_procesadas.add(nombre_carrera)
                    
                    # Etiquetamos dinámicamente si es Grado o Pregrado leyendo la URL
                    categoria = "Pregrado" if "pregrado" in href_c else "Grado / Carrera"
                    
                    guardada = carreras_viejas.get(link_real)
                    if (guardada and es_duracion_real(guardada.get("duracion"))
                            and guardada.get("plan_estudio")):
                        uda_data["carreras"].append(guardada)
                        print(f"  ⏭️ Recuperada: {nombre_carrera[:30]} — {guardada['duracion']}")
                    else:
                        print(f"  🔍 Destripando datos de: {nombre_carrera[:30]}...")
                        duracion_texto = "A confirmar"
                        plan = None
                        fuente_plan = None

                        # 3. Deep Scraping con Radar (Regex) para la duración
                        try:
                            time.sleep(0.5)
                            req_c = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                            sopa_c = BeautifulSoup(req_c.text, 'html.parser')

                            texto_pagina = sopa_c.get_text(" ")
                            # El regex de antes solo aceptaba años y semestres, y
                            # la UDA publica varias carreras en meses ("DURACIÓN
                            # 18 meses"): esas caían todas en "A confirmar".
                            hallada = extraer_duracion(texto_pagina)
                            if hallada:
                                duracion_texto = hallada

                            # Plan de estudio (pestaña "PLAN DE ESTUDIO")
                            plan = extraer_plan_uda(sopa_c)
                            if plan:
                                fuente_plan = link_real
                        except:
                            pass

                        nueva = {
                            "id": id_global,
                            "nombre_carrera": nombre_carrera,
                            "categoria": categoria,
                            # Nunca se degrada una duración buena a placeholder.
                            "duracion": mejor_duracion(duracion_texto, guardada),
                            "modalidad": "Presencial",
                            "facultad": "UDA",
                            "link_oficial": link_real
                        }
                        # Si la web no publica el plan pero ya teníamos uno
                        # guardado, se conserva el viejo.
                        plan = plan or (guardada or {}).get("plan_estudio")
                        if plan:
                            nueva["plan_estudio"] = plan
                            nueva["plan_fuente"] = (fuente_plan
                                                    or (guardada or {}).get("plan_fuente")
                                                    or link_real)
                        uda_data["carreras"].append(nueva)
                    id_global += 1
                    contador += 1
        except:
            continue

    print(f"\n✅ ¡Motor armado! Se recolectaron {contador} carreras de la UDA.")

except Exception as e:
    print(f"⚠️ Error general en UDA: {e}")

# Guardado
base_uda = {"instituciones": [uda_data]}
guardar_json(base_uda, "uda.json")
print("🎉 Archivo 'uda.json' listo para llevar al ensamblador.")