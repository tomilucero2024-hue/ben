import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, extraer_plan_anual, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V11 para IES 9-001 Gral. José de San Martín...")
print("🔍 Set up: Profesorados (4 años) y Tecnicaturas (3 años) detectados.\n")

carreras_viejas = carreras_guardadas("ies9001.json")
ies_data = {
    "id": 11,
    "nombre": "IES 9-001 Gral. José de San Martín",
    "nivel": "terciario",
    "gestion": "pública", # Etiqueta pública de fábrica
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "02623-420750",
        "email": "consultas@ens9001.edu.ar",
        "direccion": "Chubut y Balcarce, Gral. San Martín"
    },
    "carreras": []
}

# El listado bueno es /carreras/: en /ingreso-pre-inscripcion las tecnicaturas
# sin enlace propio (Diseño de Indumentaria, Acompañamiento Terapéutico) quedan
# apuntando a la página de ingreso y no hay forma de llegar a su plan.
url_ies = "https://ens9001-infd.mendoza.edu.ar/sitio/carreras/"
id_global = 1100 
contador = 0

try:
    print(f"📍 Entrando a la matriz del IES: {url_ies}")
    req = requests.get(url_ies, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)

    sopa = BeautifulSoup(req.text, 'html.parser')
    contenido = sopa.find('div', class_='entry-content') or sopa
    etiquetas_h2 = contenido.find_all('h2')
    
    for h2 in etiquetas_h2:
        texto_h2 = h2.text.strip().lower()
        
        if "profesorado" in texto_h2:
            categoria_actual = "Grado / Profesorado"
            duracion_actual = "4 años"
        elif "tecnicatura" in texto_h2:
            categoria_actual = "Pregrado / Tecnicatura"
            duracion_actual = "3 años"
        else:
            continue
            
        print(f"\n📂 Procesando bloque: {h2.text.strip()} ({duracion_actual})")
        
        lista_ul = h2.find_next_sibling('ul')
        if not lista_ul:
            continue
            
        items = lista_ul.find_all('li')
        
        for li in items:
            nombre_carrera = li.get_text(separator=' ', strip=True).replace('\xa0', ' ').replace('"', '')
            
            if "(NUEVA" in nombre_carrera:
                nombre_carrera = nombre_carrera.split("(NUEVA")[0].strip()
            
            enlaces_li = li.find_all('a')
            link_oficial = url_ies 
            
            for a in enlaces_li:
                href = a.get('href', '')
                if href and ".pdf" not in href.lower():
                    link_oficial = href
            
            if len(nombre_carrera) > 5:
                guardada = carreras_viejas.get(nombre_carrera)
                if guardada and guardada.get("plan_estudio"):
                    ies_data["carreras"].append(guardada)
                    print(f"  ⏭️ Recuperada: {nombre_carrera[:45]}...")
                else:
                    print(f"  🔍 Cortando a medida: {nombre_carrera[:45]}...")
                    plan = None
                    fuente = link_oficial
                    try:
                        time.sleep(0.4)
                        detalle = pedir_sopa(link_oficial)
                        if detalle:
                            plan = extraer_plan_anual(detalle)
                    except Exception:
                        pass
                    if not plan and guardada:
                        plan = guardada.get("plan_estudio")
                        fuente = guardada.get("plan_fuente") or fuente
                    registro = {
                        "id": id_global,
                        "nombre_carrera": nombre_carrera,
                        "categoria": categoria_actual,
                        "duracion": duracion_actual,
                        "modalidad": "Presencial",
                        "facultad": "IES 9-001 San Martín",
                        "link_oficial": link_oficial
                    }
                    if plan:
                        registro["plan_estudio"] = plan
                        registro["plan_fuente"] = fuente
                    ies_data["carreras"].append(registro)
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo prolijo! Se armaron {contador} opciones del IES 9-001.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-001: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9001.json")
print("🎉 Archivo 'ies9001.json' guardado exitosamente.")