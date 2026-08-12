import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Ajustando el radar de duración para la Universidad de Mendoza (UM)...\n")

carreras_viejas = carreras_guardadas("um.json")
um_data = {
    "id": 3,
    "nombre": "Universidad de Mendoza (UM)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4202017",
        "email": "informes@um.edu.ar",
        "direccion": "Boulogne Sur Mer 683, Ciudad"
    },
    "carreras": []
}

url_um = "https://um.edu.ar/carreras/"

try:
    req = requests.get(url_um, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    enlaces = sopa.find_all('a')
    id_global = 300
    contador = 0
    carreras_encontradas = set()
    
    for enlace in enlaces:
        href = enlace.get('href', '')
        nombre = enlace.text.strip()
        
        if "um.edu.ar/carreras/" in href and len(nombre) > 5 and nombre not in carreras_encontradas:
            if any(palabra in nombre.lower() for palabra in ["ingreso", "contacto", "aranceles", "inscripción"]):
                continue

            carreras_encontradas.add(nombre)
            
            # Si ya tenía la duración guardada y real, la respetamos
            if nombre in carreras_viejas and carreras_viejas[nombre].get("duracion") not in ["A confirmar", ""]:
                um_data["carreras"].append(carreras_viejas[nombre])
                print(f"  ⏭️ Recuperada: {nombre[:30]}...")
            else:
                print(f"  🔍 Escaneando a fondo: {nombre[:30]}...")
                duracion_texto = "A confirmar"
                facultad_texto = "UM"
                
                try:
                    time.sleep(0.5)
                    resp_det = requests.get(href, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(resp_det.text, 'html.parser')
                    
                    # 🎯 RADAR DE DURACIÓN (Busca por texto general usando Regex)
                    texto_pagina = sopa_det.get_text()
                    # Busca patrones como "Duración: 4 años" o "Duración 5 años"
                    match_duracion = re.search(r'duraci[óo]n\s*[:\-]?\s*([0-9]+\s*(?:año|años|semestre|semestres))', texto_pagina, re.IGNORECASE)
                    
                    if match_duracion:
                        duracion_texto = match_duracion.group(1).capitalize()
                    else:
                        # Plan de rescate secundario buscando dentro de los párrafos/strong
                        for strong in sopa_det.find_all(['strong', 'b']):
                            if "duración" in strong.text.lower():
                                parent_text = strong.parent.get_text()
                                match_p = re.search(r'duraci[óo]n\s*[:\-]?\s*([0-9]+\s*(?:año|años))', parent_text, re.IGNORECASE)
                                if match_p:
                                    duracion_texto = match_p.group(1).capitalize()
                                    break
                    
                    # Extracción de sedes
                    sedes = []
                    iconos_ubicacion = sopa_det.find_all('i', class_='fa-map-marker-alt')
                    for icono in iconos_ubicacion:
                        texto_sede = icono.next_sibling
                        if texto_sede and isinstance(texto_sede, str):
                            sede_limpia = texto_sede.strip(" \xa0\n\r\t")
                            if sede_limpia and sede_limpia not in sedes:
                                sedes.append(sede_limpia)
                    if sedes:
                        facultad_texto = "UM - " + " / ".join(sedes)
                        
                except Exception:
                    pass
                    
                um_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre,
                    "categoria": "Grado / Carrera",
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "facultad": facultad_texto,
                    "link_oficial": href
                })
            id_global += 1
            contador += 1
                
    print(f"\n✅ ¡Listo! Se procesaron las {contador} carreras de la UM con sus duraciones.")

except Exception as e:
    print(f"⚠️ Error general en UM: {e}")

base_um = {"instituciones": [um_data]}
guardar_json(base_um, "um.json")
print("🎉 Archivo 'um.json' actualizado con el radar de duración.")