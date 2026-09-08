import json
import os
from pathlib import Path

import time

from scraper_utils import duracion_por_plan, extraer_duracion, guardar_json, pedir_sopa

# La landing de cada carrera no dice "duración" en ninguna parte, pero publica el
# plan de estudios entero separado por año ("1er año … 5to año"): el último año
# que aparece ES la duración. Antes esto ni se intentaba y las 33 carreras de la
# UMaza salían todas con "Verificar en web oficial".
SIN_DATO = "Verificar en web oficial"


def duracion_de_landing(url, cache):
    """Duración de una carrera leyendo su landing. Cachea por URL."""
    if not url:
        return SIN_DATO
    if url in cache:
        return cache[url]
    time.sleep(0.4)  # no martillar el sitio: son ~40 fichas
    sopa = pedir_sopa(url)
    valor = SIN_DATO
    if sopa is not None:
        texto = sopa.get_text(" ")
        valor = extraer_duracion(texto) or duracion_por_plan(texto) or SIN_DATO
    cache[url] = valor
    return valor

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
    cache_duracion = {}  # varias sedes pueden compartir landing
    
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
                    if guardada and guardada.get("duracion") not in (SIN_DATO, "A confirmar", ""):
                        umaza_data["carreras"].append(guardada)
                        print(f"  ⏭️ Recuperada: {nombre_carrera} ({sede}) — {guardada['duracion']}")
                    else:
                        duracion = duracion_de_landing(link_real, cache_duracion)
                        marca = "✅" if duracion != SIN_DATO else "❔"
                        print(f"  {marca} Cazada: {nombre_carrera} ({sede}) — {duracion}")
                        umaza_data["carreras"].append({
                            "id": id_global,
                            "nombre_carrera": nombre_carrera,
                            "categoria": "Grado / Carrera",
                            "duracion": duracion,
                            "modalidad": "Presencial",
                            "facultad": facultad_texto,
                            "link_oficial": link_real
                        })
                    id_global += 1
                    contador += 1
                    
    print(f"\n✅ ¡Manso! Se guardaron {contador} opciones de la UMaza en un parpadeo.")

except Exception as e:
    print(f"⚠️ Error general en UMaza: {e}")

base_umaza = {"instituciones": [umaza_data]}
guardar_json(base_umaza, "umaza.json")
print("🎉 Archivo 'umaza.json' listo para la calle.")