import json
import os
import re
from pathlib import Path

import time

from scraper_utils import (duracion_por_plan, extraer_duracion, guardar_json,
                           limpiar_texto, pedir_sopa)

# La landing de cada carrera no dice "duración" en ninguna parte, pero publica el
# plan de estudios entero separado por año ("1er año … 5to año"): el último año
# que aparece ES la duración. Antes esto ni se intentaba y las 33 carreras de la
# UMaza salían todas con "Verificar en web oficial".
SIN_DATO = "Verificar en web oficial"


ORDINALES = {
    "1er": 1, "1ro": 1, "1°": 1, "primer": 1, "primero": 1,
    "2do": 2, "2°": 2, "segundo": 2,
    "3er": 3, "3ro": 3, "3°": 3, "tercer": 3, "tercero": 3,
    "4to": 4, "4°": 4, "cuarto": 4,
    "5to": 5, "5°": 5, "quinto": 5,
    "6to": 6, "6°": 6, "sexto": 6,
    "7mo": 7, "7°": 7, "septimo": 7,
}
# El tramo del plan no siempre es un año: los ciclos de complementación y varias
# carreras a distancia se publican por SEMESTRE o CUATRIMESTRE ("PRIMER SEMESTRE").
UNIDADES = {
    "año": "año", "ano": "año", "semestre": "semestre",
    "cuatrimestre": "cuatrimestre", "trimestre": "trimestre",
    "bimestre": "bimestre", "módulo": "módulo", "modulo": "módulo",
}
PREFIJO_ORDINAL = {1: "1er", 2: "2do", 3: "3er", 4: "4to",
                   5: "5to", 6: "6to", 7: "7mo"}
RX_TRAMO = re.compile(
    r"(?:^|[\s(])(1er|1ro|1°|primer|primero|2do|2°|segundo|"
    r"3er|3ro|3°|tercer|tercero|4to|4°|cuarto|"
    r"5to|5°|quinto|6to|6°|sexto|7mo|7°|septimo)\s+"
    r"(a[nñ]o|semestre|cuatrimestre|trimestre|bimestre|m[oó]dulo)\b",
    re.IGNORECASE,
)

# Las etiquetas de tramo no viven siempre en un encabezado: algunas landings las
# ponen en un <p> ("PRIMER AÑO"/"PRIMER SEMESTRE"), en un <strong> o incluso al
# final de otro texto ("Modalidad: A Distancia … Primer semestre"). Y las materias
# a veces cuelgan de un <ul> suelto y a veces de un <ul> envuelto en <section>/<div>.
# Por eso: se detectan las etiquetas en cualquier elemento corto y se juntan las
# listas hasta la próxima etiqueta o el próximo encabezado (así no se cuelan
# "EXTRACURRICULAR", "Pasantías" ni "Títulos").
ETIQUETAS_ELEMENTO = ("h1", "h2", "h3", "h4", "h5", "h6",
                      "p", "strong", "b", "span", "td")
ENCABEZADOS = ("h1", "h2", "h3", "h4", "h5", "h6")
RX_SECCION_PLAN = re.compile(r"materias|plan de estudio|dise[nñ]o curricular", re.I)


def _numero_de_tramo(elemento):
    """Devuelve (número, unidad) si el elemento es una etiqueta tipo '1er año'."""
    if elemento.name not in ETIQUETAS_ELEMENTO:
        return None
    texto = limpiar_texto(elemento.get_text(" ", strip=True))
    if not texto or len(texto) > 90:
        return None
    match = RX_TRAMO.search(texto)
    if not match:
        return None
    return ORDINALES[match.group(1).lower()], UNIDADES[match.group(2).lower()]


def _materias_del_bloque(etiqueta):
    """Materias que siguen a una etiqueta de tramo, sin invadir la próxima."""
    materias = []
    parrafos = []
    for hermano in etiqueta.next_siblings:
        if not getattr(hermano, "name", None):
            continue
        if hermano.name in ENCABEZADOS:
            # Un encabezado con texto cierra el tramo; uno vacío no (algunas
            # landings lo usan solo como separador).
            if limpiar_texto(hermano.get_text(" ", strip=True)):
                break
            continue
        if _numero_de_tramo(hermano) is not None:
            break
        listas = [hermano] if hermano.name == "ul" else hermano.find_all("ul")
        for lista in listas:
            for item in lista.find_all("li", recursive=False):
                materia = limpiar_texto(item.get_text(" ", strip=True))
                if materia and materia not in materias:
                    materias.append(materia)
        if hermano.name == "p":
            texto = limpiar_texto(hermano.get_text(" ", strip=True))
            if texto:
                parrafos.append(texto)
    # Algunos ciclos publican cada materia como un <p> suelto, sin <ul>.
    if not materias:
        materias = [p for p in parrafos if len(p) <= 80]
    return materias


def _plan_plano(sopa):
    """Sin tramos etiquetados: junta la lista única que cuelga de "Materias/Plan"."""
    for encabezado in sopa.find_all(["h2", "h3", "h4"]):
        titulo = limpiar_texto(encabezado.get_text(" ", strip=True))
        if not RX_SECCION_PLAN.search(titulo):
            continue
        materias = []
        for hermano in encabezado.next_siblings:
            if not getattr(hermano, "name", None):
                continue
            if hermano.name in ("h1", "h2"):
                break
            listas = [hermano] if hermano.name == "ul" else hermano.find_all("ul")
            for lista in listas:
                for item in lista.find_all("li", recursive=False):
                    materia = limpiar_texto(item.get_text(" ", strip=True))
                    if materia and materia not in materias:
                        materias.append(materia)
        if len(materias) >= 8:
            return [{"anio": "Plan de estudios", "materias": materias}]
    return None


def extraer_plan_de_sopa(sopa):
    """Extrae el bloque de plan principal, agrupado por año/semestre/cuatrimestre."""
    etiquetas = []
    for elemento in sopa.find_all(ETIQUETAS_ELEMENTO):
        dato = _numero_de_tramo(elemento)
        if dato is None:
            continue
        if any(etiqueta in elemento.parents for etiqueta, _ in etiquetas):
            continue
        etiquetas.append((elemento, dato))

    grupos = {}
    for etiqueta, (numero, unidad) in etiquetas:
        bloque = etiqueta.find_previous("h2")
        clave = limpiar_texto(bloque.get_text(" ", strip=True)) if bloque else "plan"
        estado = grupos.setdefault(clave, {"anio": None, "tramos": {}})

        if unidad == "año":
            estado["anio"] = numero
        elif estado["anio"] is not None:
            # Un año que se abre en semestres/cuatrimestres: sus materias quedan
            # agrupadas bajo el año, para no mostrar "7 semestres" donde van 4 años.
            numero, unidad = estado["anio"], "año"

        materias = _materias_del_bloque(etiqueta)
        if not materias:
            continue
        tramos = estado["tramos"]
        clave_tramo = (unidad, numero)
        if clave_tramo in tramos:
            for materia in materias:
                if materia not in tramos[clave_tramo]:
                    tramos[clave_tramo].append(materia)
        else:
            tramos[clave_tramo] = materias

    grupos = {clave: estado["tramos"] for clave, estado in grupos.items()
              if estado["tramos"]}
    if not grupos:
        return _plan_plano(sopa)

    def peso(tramos):
        return (len(tramos), sum(len(m) for m in tramos.values()))

    mejor = max(grupos.values(), key=peso)
    if len(mejor) < 2 and sum(len(m) for m in mejor.values()) < 6:
        return None
    return [{"anio": f"{PREFIJO_ORDINAL[numero]} {unidad}",
             "materias": mejor[(unidad, numero)]}
            for (unidad, numero) in sorted(mejor, key=lambda k: (k[1], k[0]))]


def datos_de_landing(url, cache):
    """Devuelve duración y plan de una landing, cacheados por URL."""
    if not url:
        return SIN_DATO, None
    if url in cache:
        return cache[url]
    time.sleep(0.4)  # no martillar el sitio: son ~40 fichas
    sopa = pedir_sopa(url)
    duracion = SIN_DATO
    plan = None
    if sopa is not None:
        texto = sopa.get_text(" ")
        duracion = extraer_duracion(texto) or duracion_por_plan(texto) or SIN_DATO
        plan = extraer_plan_de_sopa(sopa)
    cache[url] = (duracion, plan)
    return duracion, plan

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Prendiendo el escáner para la UMaza (Modo Rápido)...\n")

archivo_umaza = DIR_DATOS / "umaza.json"
carreras_viejas = {}

# Memoria adaptada (ahora la clave es nombre + sede para no mezclar)
if os.path.exists(archivo_umaza):
    try:
        with open(archivo_umaza, "r", encoding="utf-8") as f:
            datos = json.load(f)
            for c in datos["instituciones"][0].get("carreras", []):
                clave = f"{c['nombre_carrera']} - {c['facultad']}"
                carreras_viejas[clave] = c
    except:
        pass

umaza_data = {
    "id": 4,
    "nombre": "Universidad Juan Agustín Maza (UMaza)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4056200",
        "email": "informes@umaza.edu.ar",
        "direccion": "Acceso Este, Lat. Sur 2245, Guaymallén"
    },
    "carreras": []
}

url_umaza = "https://www.umaza.edu.ar/ingresoumaza"

try:
    sopa = pedir_sopa(url_umaza)
    # 🎯 Buscamos el contenedor exacto que me mostraste en la foto
    tarjetas = sopa.find_all('div', class_='card-body')
    
    id_global = 400 # Arrancamos en 400 para no chocar con las otras facus
    contador = 0
    cache_landing = {}  # varias sedes pueden compartir landing
    
    for tarjeta in tarjetas:
        titulo = tarjeta.find('h5', class_='card-title')
        if titulo:
            nombre_carrera = titulo.text.strip()
            
            # Buscamos los links de las sedes adentro del <p>
            parrafo_links = tarjeta.find('p', class_='card-text')
            if parrafo_links:
                enlaces = parrafo_links.find_all('a')
                
                # Por cada sede que tenga la carrera, armamos una tarjeta nueva
                for enlace in enlaces:
                    sede = enlace.text.strip()
                    href = enlace.get('href', '')
                    
                    # Como el href es relativo ("landings/abogacia/inicio"), le pegamos la web base adelante
                    if href and not href.startswith('http'):
                        link_real = f"https://www.umaza.edu.ar/{href.lstrip('/')}"
                    else:
                        link_real = href
                    
                    facultad_texto = f"UMaza - {sede}"
                    clave_memoria = f"{nombre_carrera} - {facultad_texto}"
                    
                    # Solo se reusa lo guardado si ya traía una duración de
                    # verdad; si quedó en el placeholder se vuelve a intentar.
                    guardada = carreras_viejas.get(clave_memoria)
                    plan_guardado = guardada.get("plan_estudio") if guardada else None
                    plan_guardado = plan_guardado if isinstance(plan_guardado, list) and len(plan_guardado) >= 3 else None
                    if guardada and guardada.get("duracion") not in (SIN_DATO, "A confirmar", "") and plan_guardado:
                        umaza_data["carreras"].append(guardada)
                        print(f"  ⏭️ Recuperada: {nombre_carrera} ({sede}) — {guardada['duracion']}")
                    else:
                        duracion, plan = datos_de_landing(link_real, cache_landing)
                        if guardada and guardada.get("duracion") not in (SIN_DATO, "A confirmar", ""):
                            duracion = guardada["duracion"]
                        if not plan:
                            plan = plan_guardado
                        if duracion in (SIN_DATO, "A confirmar", "") and plan:
                            duracion = f"{len(plan)} años"
                        marca = "✅" if duracion != SIN_DATO else "❔"
                        print(f"  {marca} Cazada: {nombre_carrera} ({sede}) — {duracion}"
                              f"{' + plan' if plan else ''}")
                        carrera = {
                            "id": id_global,
                            "nombre_carrera": nombre_carrera,
                            "categoria": "Grado / Carrera",
                            "duracion": duracion,
                            "modalidad": "Presencial",
                            "facultad": facultad_texto,
                            "link_oficial": link_real
                        }
                        if plan:
                            carrera["plan_estudio"] = plan
                            carrera["plan_fuente"] = link_real
                        umaza_data["carreras"].append(carrera)
                    id_global += 1
                    contador += 1
                    
    print(f"\n✅ ¡Manso! Se guardaron {contador} opciones de la UMaza en un parpadeo.")

except Exception as e:
    print(f"⚠️ Error general en UMaza: {e}")

base_umaza = {"instituciones": [umaza_data]}
guardar_json(base_umaza, "umaza.json")
print("🎉 Archivo 'umaza.json' listo para la calle.")
