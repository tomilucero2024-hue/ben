import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Encendiendo el escáner V9 para el IUCE...")
print("🔍 Rastreador de Modalidad (Presencial/Distancia) activado.\n")

carreras_viejas = carreras_guardadas("iuce.json")
iuce_data = {
    "id": 9,
    "nombre": "Instituto Univ. de Ciencias Empresariales (IUCE)",
    "nivel": "universidad",
    "gestion": "privada", # 👈 Etiqueta naranja lista
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4292152",
        "email": "informes@i-uce.edu.ar",
        "direccion": "Patricias Mendocinas 1374, Ciudad"
    },
    "carreras": []
}

# 👉 Cambiá esto si la URL principal es distinta
url_base_iuce = "https://i-uce.edu.ar" 
url_carreras = f"{url_base_iuce}/" # Asumimos que están en la home o cambiala por /carreras

id_global = 900 
contador = 0
carreras_procesadas = set()

try:
    print("📍 Entrando al portal del IUCE...")
    req = requests.get(url_carreras, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # Buscamos el contenedor exacto que me mostraste en la foto 1
    div_carreras = sopa.find('div', id='carreras')
    
    # Si no lo encuentra por ID, tira el mediomundo buscando los links que digan "/careers/"
    if div_carreras:
        enlaces = div_carreras.find_all('a')
    else:
        enlaces = sopa.find_all('a', href=re.compile(r'/careers/'))
        
    for a in enlaces:
        href = a.get('href', '')
        if not href or "/careers/" not in href:
            continue
            
        link_real = href if href.startswith('http') else f"{url_base_iuce}{href}"
        
        # Filtro para no raspar dos veces el mismo link
        if link_real in carreras_procesadas:
            continue
        carreras_procesadas.add(link_real)
        
        nombre_temporal = a.text.strip() or href.split('/')[-1].replace('-', ' ').title()
        
        # Memoria
        if nombre_temporal in carreras_viejas and carreras_viejas[nombre_temporal].get("duracion") not in ["Verificar en página oficial", "A confirmar", ""]:
            iuce_data["carreras"].append(carreras_viejas[nombre_temporal])
            print(f"  ⏭️ Recuperada: {nombre_temporal[:30]}...")
        else:
            print(f"  🔍 Entrando al detalle de: {link_real}")
            
            nombre_carrera = nombre_temporal
            duracion_texto = "Verificar en página oficial"
            modalidad_texto = "Presencial" # Valor por defecto
            
            try:
                time.sleep(0.5) 
                req_det = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                sopa_det = BeautifulSoup(req_det.text, 'html.parser')
                
                # 1. Sacar el nombre oficial del <h1> (Captura 2)
                h1_titulo = sopa_det.find('h1')
                if h1_titulo:
                    nombre_carrera = h1_titulo.text.strip()
                
                # 2. Sacar la duración exacta (Captura 4)
                p_duracion = sopa_det.find('p', class_='cantAnio-carrera')
                if p_duracion:
                    duracion_texto = p_duracion.text.strip().capitalize()
                    
                # 3. Sacar la modalidad (Captura 3)
                div_modalidad = sopa_det.find('div', class_='modalidad')
                if div_modalidad:
                    # Buscamos todos los <h3> adentro de modalidad (puede ser "Presencial" y "A distancia")
                    h3_mod = div_modalidad.find_all('h3')
                    modalidades_encontradas = [h3.text.strip() for h3 in h3_mod if h3.text.strip()]
                    
                    if modalidades_encontradas:
                        # Si tiene varias, las une con una barra (Ej: "Presencial / A distancia")
                        modalidad_texto = " / ".join(modalidades_encontradas)

            except Exception as e:
                pass 
                
            iuce_data["carreras"].append({
                "id": id_global,
                "nombre_carrera": nombre_carrera,
                "categoria": "Grado / Carrera",
                "duracion": duracion_texto,
                "modalidad": modalidad_texto,
                "facultad": "IUCE",
                "link_oficial": link_real
            })
        id_global += 1
        contador += 1
                
    print(f"\n✅ ¡Qué joyita! Se escanearon {contador} carreras del IUCE.")

except Exception as e:
    print(f"⚠️ Error general en IUCE: {e}")

base_iuce = {"instituciones": [iuce_data]}
guardar_json(base_iuce, "iuce.json")
print("🎉 Archivo 'iuce.json' engrasado y listo para armar.")