import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Encendiendo el purificador de noticias V3 (Escáner Global Multipunto)...")

# 1. Cargamos el tanque principal con todas las instituciones
archivo_db = DIR_DATOS / "data.json" # Asegurate de que este sea el nombre de tu archivo maestro unificado
try:
    with open(archivo_db, "r", encoding="utf-8") as f:
        datos_maestros = json.load(f)
        instituciones = datos_maestros.get("instituciones", [])
except Exception as e:
    print(f"⚠️ Falla grave: No se pudo abrir la base de datos maestra ({e})")
    exit()

# Nuestro filtro de palabras clave (tuneado para terciarios)
KEYWORDS_VALIDAS = ["inscripción", "inscripciones", "apertura", "comunicado", "ciclo", "mesa", "examen", "convocatoria", "noticia", "novedad", "beca", "curso", "capacitación", "taller", "ingreso", "oferta", "calendario"]
KEYWORDS_BASURA = ["contacto", "quienes", "autoridades", "política", "privacidad", "login", "ingresar", "términos", "olvidé", "contraseña", "mail", "teléfono", "ubicación", "mapa"]

noticias_totales = []
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'}

print(f"🚀 ¡Arrancamos! Se detectaron {len(instituciones)} instituciones en el chasis.")
print("Agarrate que esto va a tardar un ratito, vamos a recorrer toda la provincia...\n")

for inst in instituciones:
    nombre_inst = inst.get("nombre", "Institución Desconocida")
    
    # Sacamos la URL de la primera carrera para deducir la página principal
    carreras = inst.get("carreras", [])
    if not carreras:
        continue
        
    link_ejemplo = carreras[0].get("link_oficial", "")
    if not link_ejemplo:
        continue
        
    # Desarmamos el link para quedarnos solo con la base (ej: https://www.uncuyo.edu.ar)
    parsed_url = urlparse(link_ejemplo)
    url_base = f"{parsed_url.scheme}://{parsed_url.netloc}/"
    
    print(f"🔍 Analizando: {nombre_inst} -> {url_base}")
    
    try:
        # Le pegamos a la página
        response = requests.get(url_base, headers=headers, timeout=12)
        if response.status_code != 200:
            print(f"  ⚠️ Servidor rebotó la conexión (Código {response.status_code}).")
            continue
            
        soup = BeautifulSoup(response.text, 'html.parser')
        enlaces = soup.find_all('a', href=True)
        
        articulos_encontrados = 0
        for a in enlaces:
            titulo = a.get_text(strip=True)
            if not titulo and a.has_attr('title'):
                titulo = a['title']
                
            if len(titulo) < 10:
                continue
                
            titulo_lower = titulo.lower()
            es_basura = any(basura in titulo_lower for basura in KEYWORDS_BASURA)
            es_noticia = any(key in titulo_lower for key in KEYWORDS_VALIDAS)
            
            if es_noticia and not es_basura:
                link_absoluto = urljoin(url_base, a['href'])
                
                # Evitamos guardar links duplicados
                if not any(n['link'] == link_absoluto for n in noticias_totales):
                    noticias_totales.append({
                        "institucion": nombre_inst,
                        "titulo": titulo,
                        "link": link_absoluto,
                        "fecha_captura": datetime.now().strftime("%d-%m-%Y")
                    })
                    articulos_encontrados += 1
                    
        print(f"  ✅ Se rescataron {articulos_encontrados} noticias.")

    except Exception as e:
        print(f"  ⚠️ Falla mecánica (timeout/caída). Saltando al próximo...")

# Guardamos todo en el JSON
guardar_json({"noticias": noticias_totales}, "noticias.json")
print(f"\n🎉 ¡Terminó la carrera! Se guardaron un total de {len(noticias_totales)} noticias limpias en 'noticias.json'.")