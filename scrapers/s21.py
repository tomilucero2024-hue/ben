import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V10.1 para la Universidad Siglo 21 (S21)...")
print("🔍 Ajustando la caja de cambios (Paginación) y limpiando el filtro de nafta.\n")

carreras_viejas = carreras_guardadas("s21.json")
s21_data = {
    "id": 10,
    "nombre": "Universidad Siglo 21 (S21)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0810-555-0202",
        "email": "informes@21.edu.ar",
        "direccion": "San Lorenzo 258, Ciudad (Sede Mendoza)"
    },
    "carreras": []
}

id_global = 1000 
contador = 0
carreras_procesadas = set()

# Recorremos de la página 1 a la 7
for pagina in range(1, 8):
    # 🛑 CAJA DE CAMBIOS AJUSTADA: Usamos la URL exacta que me pasaste
    url_pagina = f"https://21.edu.ar/carreras-y-programas?tipo_de_formacion=pregrado%2Cgrado&currentpage={pagina}" 
    print(f"\n📍 Escaneando Página {pagina}...")
    
    try:
        req = requests.get(url_pagina, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        sopa = BeautifulSoup(req.text, 'html.parser')
        
        enlaces = sopa.find_all('a', class_='boxlink')
        
        if not enlaces:
            print("  ⚠️ La página vino vacía o el servidor bloqueó la consulta (falla de encendido).")
            continue
            
        for a in enlaces:
            href = a.get('href', '')
            if not href:
                continue
            
            # 🛑 FILTRO DE NAFTA 1: Sacamos la mugre de inscripciones
            if "inscribite.21.edu.ar" in href:
                print(f"  🚫 Mugre descartada (Link de inscripción): {href.split('/')[-1].split('?')[0]}")
                continue
                
            # 🛑 FILTRO DE NAFTA 2: Aseguramos que sea una carrera de verdad
            if "carreras-y-programas/" not in href:
                continue
                
            link_real = href if href.startswith('http') else f"https://21.edu.ar{href}"
            
            if link_real in carreras_procesadas:
                continue
            carreras_procesadas.add(link_real)
            
            # Limpiamos el nombre usando la URL para que quede lindo ("licenciatura-en-marketing" -> "Licenciatura En Marketing")
            nombre_temporal = link_real.split('/')[-1].split('?')[0].replace('-', ' ').title()
            
            if nombre_temporal in carreras_viejas and carreras_viejas[nombre_temporal].get("duracion") not in ["Verificar en página oficial", "A confirmar", ""]:
                s21_data["carreras"].append(carreras_viejas[nombre_temporal])
                print(f"  ⏭️ Recuperada: {nombre_temporal[:35]}...")
            else:
                print(f"  🔍 Entrando a la fosa: {nombre_temporal[:35]}...")
                
                nombre_carrera = nombre_temporal
                duracion_texto = "Verificar en página oficial"
                modalidad_texto = "Presencial, Híbrida o Distancia" # Por si el escáner falla
                categoria = "Grado / Carrera"
                facultad = "S21"
                
                try:
                    time.sleep(0.5) 
                    req_det = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(req_det.text, 'html.parser')
                    
                    # 1. Título real (h1)
                    h1 = sopa_det.find('h1')
                    if h1:
                        nombre_carrera = h1.text.strip()
                        
                    # Extraemos todo el texto para el Radar Regex
                    texto_completo = sopa_det.get_text(separator='\n').strip()
                    
                    # 2. Duración
                    match_dur = re.search(r'Duraci[óo]n:\s*([^\n]+)', texto_completo, re.IGNORECASE)
                    if match_dur:
                        duracion_texto = match_dur.group(1).strip()
                        
                    # 3. Modalidad
                    match_mod = re.search(r'Modalidad:\s*([^\n]+)', texto_completo, re.IGNORECASE)
                    if match_mod:
                        modalidad_texto = match_mod.group(1).strip()
                        
                    # 4. Categoría (Grado o Pregrado)
                    if re.search(r'\bpregrado\b', texto_completo, re.IGNORECASE):
                        categoria = "Pregrado"

                except Exception as e:
                    pass 
                    
                s21_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria,
                    "duracion": duracion_texto,
                    "modalidad": modalidad_texto,
                    "facultad": facultad,
                    "link_oficial": link_real
                })
            id_global += 1
            contador += 1
            
    except Exception as e:
        print(f"⚠️ Error en página {pagina}: {e}")

print(f"\n✅ ¡Motor afinado! Se escanearon {contador} carreras de la Siglo 21.")

base_s21 = {"instituciones": [s21_data]}
guardar_json(base_s21, "s21.json")
print("🎉 Archivo 's21.json' listo para llevar al ensamblador.")