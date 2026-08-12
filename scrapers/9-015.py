import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Rectificando el escáner V24 para IESVU (IES 9-015)...")
print("🔍 Set up: Separando palabras pegadas por saltos de línea.\n")

carreras_viejas = carreras_guardadas("ies9015.json")
ies_data = {
    "id": 24,
    "nombre": "IESVU (IES 9-015 Valle de Uco)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@iesvu.edu.ar",
        "direccion": "Valle de Uco, Mendoza"
    },
    "carreras": []
}

url_base = "https://iesvu.edu.ar/estudio/"
id_global = 2400 
contador = 0

try:
    print(f"📍 Abriendo el capó en: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    secciones = sopa.find_all('h2')
    
    for sec in secciones:
        titulo_seccion = sec.get_text(strip=True).lower()
        
        if "postítulo" in titulo_seccion or "especializa" in titulo_seccion:
            continue
            
        if "tecnicatura" in titulo_seccion:
            categoria_actual = "Pregrado / Tecnicatura"
        elif "curso" in titulo_seccion:
            categoria_actual = "Curso / Formación Profesional"
        else:
            continue
            
        print(f"\n⚙️ Escaneando bloque: {titulo_seccion.title()}")
        
        bloque_tarjetas = sec.find_next_sibling('div', class_='row')
        if not bloque_tarjetas:
            continue
            
        enlaces = bloque_tarjetas.find_all('a', class_='stretched-link')
        
        for a in enlaces:
            link_oficial = a.get('href', '')
            
            # 🛠️ EL ARREGLO ESTÁ ACÁ: 
            # Le decimos que cada vez que vea un salto de línea (<br>), ponga un espacio.
            nombre_carrera = a.get_text(separator=" ", strip=True)
            
            # Y por las dudas le pasamos un trapito extra por si está mal escrito en la web original
            nombre_carrera = nombre_carrera.replace("engastronomía", "en Gastronomía")
            nombre_carrera = nombre_carrera.replace("enGastronomía", "en Gastronomía")
            nombre_carrera = nombre_carrera.replace("  ", " ") # Saca dobles espacios
            
            if not link_oficial:
                continue
                
            if nombre_carrera in carreras_viejas:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"    ✔️ Recuperada de memoria: {nombre_carrera}")
            else:
                print(f"    🔍 Analizando a fondo: {nombre_carrera}...")
                
                modalidad_extraida = "A confirmar"
                duracion_extraida = "A confirmar"
                
                try:
                    req_adentro = requests.get(link_oficial, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
                    sopa_adentro = BeautifulSoup(req_adentro.text, 'html.parser')
                    
                    etiqueta_mod = sopa_adentro.find('span', string=re.compile(r'Modalidad', re.IGNORECASE))
                    if etiqueta_mod:
                        modalidad_extraida = etiqueta_mod.get_text(strip=True).replace("Modalidad", "").strip()
                        if not modalidad_extraida: 
                            modalidad_extraida = "A Distancia" if "distancia" in etiqueta_mod.get_text(strip=True).lower() else "Presencial"
                    
                    titulo_dur = sopa_adentro.find(lambda tag: tag.name in ['h2', 'h3'] and 'Duración' in tag.get_text(strip=True))
                    if titulo_dur:
                        parrafo_dur = titulo_dur.find_next_sibling('p')
                        if parrafo_dur:
                            duracion_extraida = parrafo_dur.get_text(strip=True)
                            
                except Exception as e_interno:
                    print(f"      ⚠️ No se pudo leer el interior de {nombre_carrera}: {e_interno}")
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_extraida,
                    "modalidad": modalidad_extraida,
                    "turno": "A confirmar",
                    "facultad": "IESVU (IES 9-015)",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
                time.sleep(1) 
                
    print(f"\n✅ ¡Escáner rectificado! Se extrajeron {contador} opciones del IESVU limpitas.")

except Exception as e:
    print(f"⚠️ Falla mecánica principal en IESVU: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9015.json")
print("🎉 Archivo 'ies9015.json' guardado correctamente.")