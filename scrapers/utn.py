import json
import os
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Arrancando el escáner exclusivo de la UTN...")

archivo_utn = DIR_DATOS / "utn.json"
carreras_viejas = {}

# Leemos la memoria para no pisar si ya editaste algo
if os.path.exists(archivo_utn):
    try:
        with open(archivo_utn, "r", encoding="utf-8") as f:
            datos = json.load(f)
            for c in datos["instituciones"][0].get("carreras", []):
                carreras_viejas[c["nombre_carrera"]] = c
    except:
        pass

utn_data = {
    "id": 1,
    "nombre": "UTN Facultad Regional Mendoza",
    "carreras": []
}

urls_utn = [
    {"url": "https://www.frm.utn.edu.ar/ingenierias/", "cat": "Ingeniería"},
    {"url": "https://www.frm.utn.edu.ar/tecnicaturas-superiores/", "cat": "Tecnicatura"}
]

# 🧹 EL FILTRO DEFINITIVO (Acá matamos a "Información" y "Encuestas")
basura = ["información", "encuestas", "tecnicaturas", "ingenierías", "e-mail", "@", "facebook", "copyright", "diseño", "trámites", "canales", "contacto", "leer m", "rodríguez", "república"]

id_global = 1

for item in urls_utn:
    print(f"📍 Revisando: {item['cat']}s")
    try:
        req = requests.get(item["url"], timeout=15)
        sopa = BeautifulSoup(req.text, "html.parser")
        bloques = sopa.find_all("div", class_="elementor-widget-wrap")
        
        for bloque in bloques:
            titulo = bloque.find("h2", class_="elementor-heading-title")
            if titulo:
                nombre = titulo.text.strip()
                nombre_lower = nombre.lower()
                
                # Verificamos si es un menú infiltrado
                es_basura = any(b in nombre_lower for b in basura)
                
                if not es_basura and nombre:
                    if nombre in carreras_viejas and carreras_viejas[nombre].get("duracion") not in ["A confirmar", ""]:
                        utn_data["carreras"].append(carreras_viejas[nombre])
                        print(f"  ⏭️ Recuperada de memoria: {nombre}")
                    else:
                        enlace = bloque.find("a")
                        link_real = enlace["href"] if enlace and "href" in enlace.attrs else item["url"]
                        
                        # Intento de Deep Scraping rápido para UTN
                        duracion = "A confirmar"
                        try:
                            resp_det = requests.get(link_real, timeout=10)
                            sopa_det = BeautifulSoup(resp_det.text, "html.parser")
                            for p in sopa_det.find_all(['p', 'div', 'li']):
                                texto = p.text.lower()
                                if "año" in texto and len(p.text) < 50:
                                    # Sacamos la etiqueta ("DURACIÓN", tabs, saltos de línea)
                                    # y dejamos solo el valor, ej. "5 años".
                                    limpio = re.sub(r'(?i)^duraci[oó]n\s*', '', p.text.strip())
                                    duracion = re.sub(r'\s+', ' ', limpio).strip()
                                    break
                        except:
                            pass

                        utn_data["carreras"].append({
                            "id": id_global,
                            "nombre_carrera": nombre,
                            "categoria": item["cat"],
                            "duracion": duracion,
                            "modalidad": "Presencial",
                            "facultad": "UTN FRM",
                            "link_oficial": link_real
                        })
                        print(f"  ✅ Agregada limpia: {nombre} | Duración: {duracion[:15]}")
                    id_global += 1
    except Exception as e:
        print(f"⚠️ Falla en UTN: {e}")

base_utn = {"instituciones": [utn_data]}
guardar_json(base_utn, "utn.json")
print("\n🎉 UTN terminada. Todo guardado impecable en 'utn.json'.")