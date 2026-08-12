import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V15 para IES 9-005...")
print("🔍 Set up: Profesorados (4 años) y Formación Profesional (1.5 años) detectados.\n")

carreras_viejas = carreras_guardadas("ies9005.json")
ies_data = {
    "id": 15,
    "nombre": "IES 9-005",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0263-4442371",
        "email": "ens9005@infd.edu.ar",
        "direccion": "San Martín y Godoy Cruz, Junín, Mendoza"
    },
    "carreras": []
}

url_base = "https://ens9005-infd.mendoza.edu.ar/sitio/"
id_global = 1500 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a la página principal: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # Buscamos el menú de navegación principal (Captura 1)
    menu = sopa.find('nav', id='site-navigation') or sopa
    enlaces = menu.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        nombre_carrera = a.get_text(separator=' ', strip=True)
        nombre_lower = nombre_carrera.lower()
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos para asegurar que sean links internos del sitio educativo
        if "/sitio/" not in link_oficial or "mendoza.edu.ar" not in link_oficial:
            continue
            
        # Identificamos si es un profesorado o una formación profesional
        if "profesorado" in nombre_lower or "formacion-profesional" in link_oficial.lower() or "apicultura" in nombre_lower or "software" in nombre_lower:
            carreras_procesadas.add(link_oficial)
            
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("duracion") not in ["A confirmar"]:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Analizando: {nombre_carrera[:35]}...")
                
                # Asignamos categoría y duración según corresponda
                if "formacion-profesional" in link_oficial.lower() or "formación" in nombre_lower:
                    categoria_actual = "Formación Profesional"
                    duracion_texto = "1 año y medio"
                else:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                    
                modalidad_texto = "Presencial"
                turno_texto = "A confirmar"
                
                try:
                    time.sleep(0.4)
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
                    "facultad": "IES 9-005",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo terminado! Se escanearon {contador} opciones del IES 9-005.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-005: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9005.json")
print("🎉 Archivo 'ies9005.json' guardado con éxito.")