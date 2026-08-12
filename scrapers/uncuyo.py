import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Arrancando escáner de la UNCuyo (con raspado profundo de duración)...")

carreras_viejas = carreras_guardadas("uncuyo.json")
uncuyo_data = {
    "id": 2,
    "nombre": "Universidad Nacional de Cuyo (UNCuyo)",
    "carreras": []
}

try:
    url_uncuyo = "https://www.uncuyo.edu.ar/estudios/grado"
    req_un = requests.get(url_uncuyo, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
    sopa_un = BeautifulSoup(req_un.text, 'html.parser')
    tarjetas = sopa_un.find_all('div', class_=lambda x: x and 'card-estudio' in x)
    
    id_global = 100 # Empezamos de 100 para que los IDs no se pisen con la UTN
    
    for tarjeta in tarjetas:
        h3 = tarjeta.find('h3', class_='card-title')
        if h3 and h3.find('a'):
            enlace = h3.find('a')
            nombre = enlace.text.strip()
            
            if nombre in carreras_viejas and carreras_viejas[nombre].get("duracion") not in ["A confirmar", ""]:
                uncuyo_data["carreras"].append(carreras_viejas[nombre])
                print(f"  ⏭️ Recuperada: {nombre[:30]}...")
            else:
                href = enlace.get('href', '')
                link_real = href if href.startswith('http') else "https://www.uncuyo.edu.ar" + href
                span_facultad = tarjeta.find('span', class_='facultad')
                fac = span_facultad.text.strip() if span_facultad else "UNCuyo"
                
                print(f"  🔍 Buscando duración de: {nombre[:30]}...")
                duracion_texto = "A confirmar"
                
                try:
                    time.sleep(0.5) # Pausa vital para no saturar el servidor
                    resp_det = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(resp_det.text, 'html.parser')
                    
                    h2_elementos = sopa_det.find_all('h2', class_='contenido_titulo')
                    for h2 in h2_elementos:
                        if "duración" in h2.text.lower():
                            siguiente_div = h2.find_next_sibling('div')
                            if siguiente_div:
                                duracion_texto = siguiente_div.text.strip()
                            else:
                                seccion = h2.find_parent('section')
                                if seccion:
                                    div_mb4 = seccion.find('div', class_='mb-4')
                                    if div_mb4:
                                        duracion_texto = div_mb4.text.strip()
                            break
                    
                    if duracion_texto == "A confirmar":
                        for el in sopa_det.find_all(['div', 'p']):
                            t = el.text.strip()
                            if "año" in t.lower() and any(char.isdigit() for char in t) and len(t) < 40:
                                duracion_texto = t
                                break
                except:
                    pass # Si un link falla, sigue viaje
                
                uncuyo_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre,
                    "categoria": "Grado / Carrera",
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "facultad": fac,
                    "link_oficial": link_real
                })
            id_global += 1
except Exception as e:
    print(f"⚠️ Error general en UNCuyo: {e}")

base_uncuyo = {"instituciones": [uncuyo_data]}
guardar_json(base_uncuyo, "uncuyo.json")
print("\n🎉 UNCuyo terminada y guardada en 'uncuyo.json'.")