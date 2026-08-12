import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V13 para IES 9-003 Normal (San Rafael)...")
print("🔍 Radar Universal activado para leer tablas y textos.\n")

carreras_viejas = carreras_guardadas("ies9003.json")
ies_data = {
    "id": 13,
    "nombre": "IES 9-003 Normal (San Rafael)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0260-4422262",
        "email": "ens9003@gmail.com",
        "direccion": "Julio Silva y Barcala, San Rafael"
    },
    "carreras": []
}

# Nos salteamos la página de inicio y vamos directo a las dos secciones (Foto 1)
rutas = [
    ("https://ens9003-infd.mendoza.edu.ar/sitio/carreras-profesorados/", "Grado / Profesorado", "4 años"),
    ("https://ens9003-infd.mendoza.edu.ar/sitio/carreras-tecnicaturas/", "Pregrado / Tecnicatura", "3 años")
]

id_global = 1300 
contador = 0
carreras_procesadas = set()

try:
    for url_seccion, cat_default, dur_default in rutas:
        print(f"\n📍 Entrando a la sección: {cat_default}")
        req = requests.get(url_seccion, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        sopa = BeautifulSoup(req.text, 'html.parser')
        
        # Buscamos en el contenedor principal de la tabla (Foto 2)
        contenido = sopa.find('div', class_='entry-content')
        if not contenido:
            continue
            
        enlaces = contenido.find_all('a')
        
        for a in enlaces:
            link_oficial = a.get('href', '')
            
            # Filtramos para que solo agarre links de la propia facultad
            if not link_oficial or "mendoza.edu.ar/sitio/" not in link_oficial or link_oficial in carreras_procesadas:
                continue
                
            carreras_procesadas.add(link_oficial)
            
            # Limpiamos el nombre base con la URL
            nombre_temporal = link_oficial.strip('/').split('/')[-1].replace('-', ' ').title()
            
            if nombre_temporal in carreras_viejas and carreras_viejas[nombre_temporal].get("duracion") not in ["Verificar en web", "A confirmar"]:
                ies_data["carreras"].append(carreras_viejas[nombre_temporal])
                print(f"  ⏭️ Recuperada: {nombre_temporal[:30]}...")
            else:
                print(f"  🔍 Analizando: {nombre_temporal[:30]}...")
                
                nombre_carrera = nombre_temporal
                duracion_texto = dur_default # Le ponemos la duración por defecto de la sección
                modalidad_texto = "Presencial"
                turno_texto = "A confirmar"
                
                try:
                    time.sleep(0.5)
                    req_det = requests.get(link_oficial, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(req_det.text, 'html.parser')
                    
                    # 1. Buscar Título Exacto en el H1
                    h1 = sopa_det.find('h1')
                    if h1:
                        nombre_carrera = h1.text.strip()
                    
                    # 2. El Radar Universal (Regex): Como no llegó la 3ra foto, escaneamos TODO el texto
                    texto_completo = sopa_det.get_text(separator=' ')
                    
                    # Buscamos si hay otra duración escondida
                    match_dur = re.search(r'Duraci[óo]n:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                    if match_dur:
                        duracion_texto = match_dur.group(1).strip()
                        
                    # Buscamos la Modalidad
                    match_mod = re.search(r'Modalidad:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                    if match_mod:
                        modalidad_texto = match_mod.group(1).strip()
                        
                    # Buscamos el Turno (si es que existe)
                    match_turno = re.search(r'Turno[s]?:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                    if match_turno:
                        turno_texto = match_turno.group(1).strip()

                except Exception as e:
                    print(f"   ⚠️ Fallo al revisar interior: {e}")
                
                print(f"   ✨ Ficha -> Duración: [{duracion_texto}] | Modalidad: [{modalidad_texto}]")
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": cat_default,
                    "duracion": duracion_texto,
                    "modalidad": modalidad_texto,
                    "turno": turno_texto,
                    "facultad": "IES 9-003 Normal (San Rafael)",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Pista libre! Se escanearon {contador} carreras del IES 9-003.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-003: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9003.json")
print("🎉 Archivo 'ies9003.json' guardado exitosamente.")