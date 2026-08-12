import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V12.2 para IES Tomás Godoy Cruz (9-002)...")
print("🔍 Radar de Duración y Turno reforzado con búsqueda universal.\n")

carreras_viejas = carreras_guardadas("ies_godoycruz.json")
ies_data = {
    "id": 12,
    "nombre": "IES 9-002 Tomás Godoy Cruz",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0261-4235077",
        "email": "contacto@institutotomasgodoycruz.com",
        "direccion": "Mitre y Montevideo, Ciudad de Mendoza"
    },
    "carreras": []
}

url_base = "https://institutotomasgodoycruz.com/carreras/"
id_global = 1200 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a la matriz principal: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    tarjetas = sopa.find_all('a', class_='tgc-carrera-page-card')
    print(f"🔎 Se detectaron {len(tarjetas)} tarjetas para inspeccionar.\n")
    
    for tarjeta in tarjetas:
        link_oficial = tarjeta.get('href', '')
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        carreras_procesadas.add(link_oficial)
        nombre_temporal = link_oficial.strip('/').split('/')[-1].replace('-', ' ').title()
        
        print(f"🔍 Revisando chasis de: {nombre_temporal[:30]}...")
        
        nombre_carrera = nombre_temporal
        duracion_texto = "A confirmar"
        turno_texto = "A confirmar"
        categoria_actual = "Pregrado / Tecnicatura"
        
        try:
            time.sleep(0.5)
            req_det = requests.get(link_oficial, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            sopa_det = BeautifulSoup(req_det.text, 'html.parser')
            
            # 1. Título oficial
            h1 = sopa_det.find('h1')
            if h1:
                nombre_carrera = h1.text.strip()
                
            if "profesorado" in nombre_carrera.lower():
                categoria_actual = "Grado / Profesorado"
            
            # 2. Intento A: Buscando por las insignias visuales (pei-badge)
            insignias = sopa_det.find_all('span', class_='pei-badge')
            for insignia in insignias:
                texto_ins = insignia.get_text(separator=' ', strip=True).lower()
                if "año" in texto_ins or "anos" in texto_ins:
                    duracion_texto = insignia.get_text(separator=' ', strip=True).capitalize()
                elif "turno" in texto_ins:
                    turno_texto = insignia.get_text(separator=' ', strip=True).capitalize()

            # 3. Intento B (Plan de Emergencia con Regex): Si no encontró duración, la busca en todo el texto
            texto_total = sopa_det.get_text(separator=' ')
            if duracion_texto == "A confirmar":
                match_dur = re.search(r'(\d+\s*años?)', texto_total, re.IGNORECASE)
                if match_dur:
                    duracion_texto = match_dur.group(1).capitalize()

            # Si no encontró turno, lo busca en todo el texto
            if turno_texto == "A confirmar":
                match_turno = re.search(r'(turno\s+[^\n–—]+)', texto_total, re.IGNORECASE)
                if match_turno:
                    turno_texto = match_turno.group(1).strip().capitalize()

        except Exception as e:
            print(f"   ⚠️ Alerta en detalle: {e}")
            
        print(f"   ✨ Ficha técnica -> Duración: [{duracion_texto}] | Turno: [{turno_texto}]\n")
        
        ies_data["carreras"].append({
            "id": id_global,
            "nombre_carrera": nombre_carrera,
            "categoria": categoria_actual,
            "duracion": duracion_texto,
            "turno": turno_texto,
            "modalidad": "Presencial",
            "facultad": "IES Tomás Godoy Cruz",
            "link_oficial": link_oficial
        })
        id_global += 1
        contador += 1
            
    print(f"\n✅ ¡Escaneo impecable! Se procesaron {contador} carreras con éxito.")

except Exception as e:
    print(f"⚠️ Falla general: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies_godoycruz.json")
print("🎉 Archivo 'ies_godoycruz.json' actualizado y reparado.")