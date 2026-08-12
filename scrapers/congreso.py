import json
import os
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Encendiendo el escáner de la Universidad de Congreso (UC)...")

archivo_uc = DIR_DATOS / "ucongreso.json"
carreras_viejas = {}

# 1. Cargamos la memoria del taller
if os.path.exists(archivo_uc):
    try:
        with open(archivo_uc, "r", encoding="utf-8") as f:
            datos = json.load(f)
            for c in datos["instituciones"][0].get("carreras", []):
                carreras_viejas[c["nombre_carrera"]] = c
    except:
        pass

uc_data = {
    "id": 5,
    "nombre": "Universidad de Congreso (UC)",
    "nivel": "universidad",
    "gestion": "privada", # 👈 Ya seteado como privada
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4230630",
        "email": "informes@ucongreso.edu.ar",
        "direccion": "Colón 90, Ciudad"
    },
    "carreras": []
}

# Hacemos el mapeo manual de las facultades que vimos en tu captura para ir a lo seguro
facultades = {
    "Estudios Internacionales": "https://www.ucongreso.edu.ar/facultad/estudios-internacionales/",
    "Humanidades": "https://www.ucongreso.edu.ar/facultad/humanidades/",
    "Ambiente, Arquitectura y Urbanismo": "https://www.ucongreso.edu.ar/facultad/ambiente-arquitectura-y-urbanismo/",
    "Ciencias de la Salud": "https://www.ucongreso.edu.ar/facultad/ciencias-de-la-salud/",
    "Ciencias Económicas y de la Administración": "https://www.ucongreso.edu.ar/facultad/ciencias-economicas-y-de-la-administracion/",
    "Ciencias Jurídicas": "https://www.ucongreso.edu.ar/facultad/ciencias-juridicas/"
}

id_global = 500 # Rango 500 para la UC
contador = 0

try:
    for nombre_facultad, url_facultad in facultades.items():
        print(f"\n📍 Entrando a la Facultad de {nombre_facultad}...")
        
        req = requests.get(url_facultad, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        sopa = BeautifulSoup(req.text, 'html.parser')
        
        # Según tu captura 2, los enlaces tienen la clase 'careers-item post-item'
        tarjetas = sopa.find_all('a', class_='careers-item')
        
        for tarjeta in tarjetas:
            # Sacamos el nombre de la etiqueta <h3 class="title">
            titulo_h3 = tarjeta.find('h3', class_='title')
            if not titulo_h3:
                continue
                
            nombre_carrera = titulo_h3.text.strip()
            link_real = tarjeta.get('href', '')
            
            # Verificamos memoria
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("duracion") not in ["A confirmar", ""]:
                uc_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera}")
            else:
                print(f"  🔍 Escaneando a fondo: {nombre_carrera}")
                duracion_texto = "A confirmar"
                
                # --- DEEP SCRAPING DE DURACIÓN (Basado en tu Captura 3) ---
                try:
                    time.sleep(0.5) # Ralentí
                    resp_det = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(resp_det.text, 'html.parser')
                    
                    # Buscamos los bloques <div class="data-item">
                    bloques_data = sopa_det.find_all('div', class_='data-item')
                    for bloque in bloques_data:
                        label = bloque.find('div', class_='label')
                        if label and 'duración' in label.text.lower():
                            valor = bloque.find('div', class_='value')
                            if valor:
                                duracion_texto = valor.text.strip()
                            break
                except Exception as e:
                    pass # Falla silenciosa si no carga la página de la carrera
                    
                uc_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": "Grado / Carrera",
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "facultad": f"UC - {nombre_facultad}",
                    "link_oficial": link_real
                })
            id_global += 1
            contador += 1
            
    print(f"\n✅ ¡Trabajo impecable! Se recolectaron {contador} carreras de la U. de Congreso.")

except Exception as e:
    print(f"⚠️ Error general en U. de Congreso: {e}")

# Guardamos el archivo
base_uc = {"instituciones": [uc_data]}
guardar_json(base_uc, "ucongreso.json")
print("🎉 Archivo 'ucongreso.json' empacado y listo.")