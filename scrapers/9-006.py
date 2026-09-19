import re
import time

import requests
from bs4 import BeautifulSoup

from pdf_utils import plan_desde_url_pdf, primer_pdf_de_plan
from scraper_utils import carreras_guardadas, extraer_plan_anual, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V16 para IES 9-006 Francisco H. Tolosa (Rivadavia)...")
print("🔍 Set up: Profesorados (4 años) y Tecnicaturas (3 años) detectados.\n")

carreras_viejas = carreras_guardadas("ies9006.json")
ies_data = {
    "id": 16,
    "nombre": "IES 9-006 Francisco H. Tolosa",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0263-4422582",
        "email": "ens9006@infd.edu.ar",
        "direccion": "Aristóbulo del Valle y Lavalle, Rivadavia"
    },
    "carreras": []
}

url_base = "https://ens9006-infd.mendoza.edu.ar/sitio/"
id_global = 1600 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a la base del IES 9-006: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # Buscamos el menú principal de navegación
    menu = sopa.find('nav', id='site-navigation') or sopa
    enlaces = menu.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        nombre_carrera = a.get_text(separator=' ', strip=True)
        nombre_lower = nombre_carrera.lower()
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos solo enlaces internos del sitio institucional
        if "/sitio/" not in link_oficial or "mendoza.edu.ar" not in link_oficial:
            continue
            
        # "Profesorados" y "Tecnicaturas" son los títulos del menú, no carreras.
        if re.fullmatch(r"(profesorados|tecnicaturas)", nombre_carrera.strip(), re.I):
            continue

        # Identificamos si es profesorado o tecnicatura
        if "profesorado" in nombre_lower or "tecnicatura" in nombre_lower:
            carreras_procesadas.add(link_oficial)
            
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("plan_estudio"):
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Analizando: {nombre_carrera[:35]}...")
                
                if "profesorado" in nombre_lower:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                else:
                    categoria_actual = "Pregrado / Tecnicatura"
                    duracion_texto = "3 años"
                    
                modalidad_texto = "Presencial"
                turno_texto = "A confirmar"
                plan = None
                
                try:
                    time.sleep(0.3)
                    sopa_det = pedir_sopa(link_oficial)
                    if sopa_det:
                        texto_completo = sopa_det.get_text(separator=' ')
                        match_turno = re.search(r'Turno[s]?:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                        if match_turno:
                            turno_texto = match_turno.group(1).strip()
                        
                        # El plan publicado en la página manda; si no está, se
                        # baja el PDF del flyer a dos columnas.
                        plan = extraer_plan_anual(sopa_det)
                        if not plan:
                            plan = plan_desde_url_pdf(primer_pdf_de_plan(sopa_det))
                except Exception as e:
                    pass
                
                if not plan:
                    guardada = carreras_viejas.get(nombre_carrera)
                    if guardada:
                        plan = guardada.get("plan_estudio")
                
                print(f"   ✨ Ficha -> {categoria_actual} | Duración: [{duracion_texto}] | Plan: {'sí' if plan else 'no'}")
                
                registro = {
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_texto,
                    "modalidad": modalidad_texto,
                    "turno": turno_texto,
                    "facultad": "IES 9-006 Francisco H. Tolosa",
                    "link_oficial": link_oficial
                }
                if plan:
                    registro["plan_estudio"] = plan
                    registro["plan_fuente"] = link_oficial
                ies_data["carreras"].append(registro)
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo fino! Se escanearon {contador} opciones del IES 9-006.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-006: {e}")

# El menú del sitio cambia: una carrera puede desaparecer del nav sin dejar de
# existir (pasó con Producción Artística Artesanal). Conservamos las ya
# guardadas que hoy no aparecieron.
vistas = {c["nombre_carrera"] for c in ies_data["carreras"]}
for nombre, guardada in carreras_viejas.items():
    if nombre in vistas:
        continue
    if re.fullmatch(r"(profesorados|tecnicaturas)", nombre.strip(), re.I):
        continue
    if guardada.get("link_oficial"):
        ies_data["carreras"].append(guardada)
        print(f"  💾 Conservada del archivo anterior: {nombre[:40]}...")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9006.json")
print("🎉 Archivo 'ies9006.json' guardado correctamente.")