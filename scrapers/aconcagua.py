import json
import os
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Encendiendo el escáner V6 para la Universidad del Aconcagua (UDA)...\n")

archivo_uda = DIR_DATOS / "uda.json"
carreras_viejas = {}

# Memoria del taller
if os.path.exists(archivo_uda):
    try:
        with open(archivo_uda, "r", encoding="utf-8") as f:
            datos = json.load(f)
            for c in datos["instituciones"][0].get("carreras", []):
                carreras_viejas[c["nombre_carrera"]] = c
    except:
        pass

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
                if ("carreras-de-grado" in href_c or "carreras-de-pregrado" in href_c) and len(nombre_carrera) > 4:
                    if not href_c.startswith("http"):
                        link_real = "https://www.uda.edu.ar" + href_c
                    else:
                        link_real = href_c
                        
                    if nombre_carrera in carreras_procesadas:
                        continue
                    carreras_procesadas.add(nombre_carrera)
                    
                    # Etiquetamos dinámicamente si es Grado o Pregrado leyendo la URL
                    categoria = "Pregrado" if "pregrado" in href_c else "Grado / Carrera"
                    
                    if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("duracion") not in ["A confirmar", ""]:
                        uda_data["carreras"].append(carreras_viejas[nombre_carrera])
                        print(f"  ⏭️ Recuperada: {nombre_carrera[:30]}...")
                    else:
                        print(f"  🔍 Destripando datos de: {nombre_carrera[:30]}...")
                        duracion_texto = "A confirmar"
                        
                        # 3. Deep Scraping con Radar (Regex) para la duración
                        try:
                            time.sleep(0.5)
                            req_c = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                            sopa_c = BeautifulSoup(req_c.text, 'html.parser')
                            
                            texto_pagina = sopa_c.get_text()
                            match_duracion = re.search(r'duraci[óo]n\s*[:\-]?\s*([0-9]+\s*(?:año|años|semestre|semestres))', texto_pagina, re.IGNORECASE)
                            if match_duracion:
                                duracion_texto = match_duracion.group(1).capitalize()
                        except:
                            pass
                            
                        uda_data["carreras"].append({
                            "id": id_global,
                            "nombre_carrera": nombre_carrera,
                            "categoria": categoria,
                            "duracion": duracion_texto,
                            "modalidad": "Presencial",
                            "facultad": "UDA",
                            "link_oficial": link_real
                        })
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