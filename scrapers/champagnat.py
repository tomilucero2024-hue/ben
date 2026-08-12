import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V7.3 para la Universidad Champagnat (UCh)...")
print("🔍 Doble filtro activado: Limpiando facultades y purgando links basura.\n")

carreras_viejas = carreras_guardadas("uch.json")
uch_data = {
    "id": 7,
    "nombre": "Universidad Champagnat (UCh)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4243698",
        "email": "informes@uch.edu.ar",
        "direccion": "Belgrano 721, Godoy Cruz"
    },
    "carreras": []
}

url_uch = "https://www.uch.edu.ar/"
id_global = 700 
contador = 0

try:
    req = requests.get(url_uch, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    tarjetas = sopa.find_all('div', class_='card')
    
    for tarjeta in tarjetas:
        titulo_facu = tarjeta.find('h3', class_='card-title')
        if not titulo_facu:
            continue
            
        facultad_nombre = titulo_facu.text.strip()
        facu_lower = facultad_nombre.lower()
        
        # 🛑 FILTRO 1: Filtramos la tarjeta entera si es basura
        if any(palabra in facu_lower for palabra in ["posgrado", "ciccsi", "instituto", "investigadores", "investigador"]):
            continue
            
        if "facultad" not in facu_lower:
            continue

        print(f"\n📍 Entrando a: {facultad_nombre}")
        
        enlaces = tarjeta.find_all('a', class_='item-filto')
        
        for a in enlaces:
            nombre_carrera = a.get_text(separator=" ", strip=True)
            nombre_lower = nombre_carrera.lower()
            href = a.get('href', '')
            
            # 🛑 FILTRO 2: Mata los links individuales colados (¡Acá limpiamos los CICCSI e Institutos rebeldes!)
            if any(palabra in nombre_lower for palabra in ["ciccsi", "instituto", "investigacion", "investigación", "posgrado", "diplomatura"]):
                print(f"  🚫 Mugre colada bloqueada: {nombre_carrera}")
                continue

            if len(nombre_carrera) > 4 and href:
                link_real = href if href.startswith('http') else f"https://www.uch.edu.ar{href}"
                
                # Memoria
                if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("duracion") not in ["Verificar en página oficial", "A confirmar", ""]:
                    uch_data["carreras"].append(carreras_viejas[nombre_carrera])
                    print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
                else:
                    print(f"  🔍 Analizando a fondo: {nombre_carrera[:35]}...")
                    
                    duracion_texto = "Verificar en página oficial" 
                    
                    try:
                        time.sleep(0.5) 
                        req_det = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                        sopa_det = BeautifulSoup(req_det.text, 'html.parser')
                        
                        bloques_info = sopa_det.find_all('div', class_='info')
                        
                        for info in bloques_info:
                            texto_info = info.get_text(separator=' ', strip=True).lower()
                            match = re.search(r'\(?(\d+\s*años?)\)?', texto_info)
                            
                            if match:
                                duracion_texto = match.group(1).capitalize()
                                if 'grado' in texto_info:
                                    break 
                    except Exception:
                        pass 
                        
                    uch_data["carreras"].append({
                        "id": id_global,
                        "nombre_carrera": nombre_carrera,
                        "categoria": "Grado / Carrera",
                        "duracion": duracion_texto,
                        "modalidad": "Presencial",
                        "facultad": facultad_nombre,
                        "link_oficial": link_real
                    })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Doble filtro impecable! Se recolectaron {contador} carreras de la U. Champagnat.")

except Exception as e:
    print(f"⚠️ Error general en UCh: {e}")

base_uch = {"instituciones": [uch_data]}
guardar_json(base_uch, "uch.json")
print("🎉 Archivo 'uch.json' actualizado y recontra purgado.")