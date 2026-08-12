import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V16 para IES 9-006 Francisco H. Tolosa (Rivadavia)...")
print("🔍 Set up: Profesorados (4 años) y Tecnicaturas (3 años) detectados.\n")

carreras_viejas = carreras_guardadas("ies9006.json")
ies_data = {
    "id": 16,
    "nombre": "IES 9-006 Francisco H. Tolosa",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0263-4422582",
        "email": "ens9006@infd.edu.ar",
        "direccion": "Aristóbulo del Valle y Lavalle, Rivadavia"
    },
    "carreras": []
}

url_base = "https://ens9006-infd.mendoza.edu.ar/sitio/"
id_global = 1600 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a la base del IES 9-006: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # Buscamos el menú principal de navegación
    menu = sopa.find('nav', id='site-navigation') or sopa
    enlaces = menu.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        nombre_carrera = a.get_text(separator=' ', strip=True)
        nombre_lower = nombre_carrera.lower()
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos solo enlaces internos del sitio institucional
        if "/sitio/" not in link_oficial or "mendoza.edu.ar" not in link_oficial:
            continue
            
        # Identificamos si es profesorado o tecnicatura
        if "profesorado" in nombre_lower or "tecnicatura" in nombre_lower:
            carreras_procesadas.add(link_oficial)
            
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("duracion") not in ["A confirmar"]:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Analizando: {nombre_carrera[:35]}...")
                
                if "profesorado" in nombre_lower:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                else:
                    categoria_actual = "Pregrado / Tecnicatura"
                    duracion_texto = "3 años"
                    
                modalidad_texto = "Presencial"
                turno_texto = "A confirmar"
                
                try:
                    time.sleep(0.3)
                    req_det = requests.get(link_oficial, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(req_det.text, 'html.parser')
                    
                    texto_completo = sopa_det.get_text(separator=' ')
                    match_turno = re.search(r'Turno[s]?:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                    if match_turno:
                        turno_texto = match_turno.group(1).strip()
                except Exception as e:
                    pass
                    
                print(f"   ✨ Ficha -> {categoria_actual} | Duración: [{duracion_texto}]")
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_texto,
                    "modalidad": modalidad_texto,
                    "turno": turno_texto,
                    "facultad": "IES 9-006 Francisco H. Tolosa",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo fino! Se escanearon {contador} opciones del IES 9-006.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-006: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9006.json")
print("🎉 Archivo 'ies9006.json' guardado correctamente.")