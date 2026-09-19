import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, extraer_plan_anual, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V14 para IES 9-004 Toribio de Luzuriaga (Tunuyán)...")
print("🔍 Ojo: Datos en imágenes detectados. Activando deducción lógica desde el menú.\n")

carreras_viejas = carreras_guardadas("ies9004.json")
ies_data = {
    "id": 14,
    "nombre": "IES 9-004 Gral. Toribio de Luzuriaga",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "02622-422847",
        "email": "ies9004@infd.edu.ar",
        "direccion": "Ruta 40 (N) Km 81, Tunuyán"
    },
    "carreras": []
}

# Usamos la página principal porque ahí está el menú con todas las carreras (Foto 1)
url_base = "https://ens9004-infd.mendoza.edu.ar/sitio/"

id_global = 1400 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a la página principal para leer el menú: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # Buscamos el menú de navegación (Captura 1)
    menu = sopa.find('nav', id='site-navigation')
    enlaces = menu.find_all('a') if menu else sopa.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        nombre_carrera = a.get_text(separator=' ', strip=True)
        nombre_lower = nombre_carrera.lower()
        
        # Filtramos links vacíos o repetidos
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # 🛑 FILTRO DE NAFTA: Volamos las actualizaciones, cursos y postítulos
        if "actualizacion" in nombre_lower or "postitulo" in nombre_lower:
            continue
            
        # Si es Profesorado o Tecnicatura, la metemos al taller
        if "profesorado" in nombre_lower or "tecnicatura" in nombre_lower:
            carreras_procesadas.add(link_oficial)
            
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("plan_estudio"):
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Analizando: {nombre_carrera[:35]}...")
                
                # Deducción lógica de la cilindrada (Categoría y Duración)
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
                    time.sleep(0.4)
                    sopa_det = pedir_sopa(link_oficial)
                    if sopa_det:
                        # Radar Universal de texto por si aclaran modalidad o turno abajo de la imagen
                        texto_completo = sopa_det.get_text(separator=' ')
                        
                        match_mod = re.search(r'Modalidad:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                        if match_mod:
                            modalidad_texto = match_mod.group(1).strip()
                            
                        match_turno = re.search(r'Turno[s]?:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                        if match_turno:
                            turno_texto = match_turno.group(1).strip()
                        
                        plan = extraer_plan_anual(sopa_det)
                        
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
                    "facultad": "IES 9-004 Toribio de Luzuriaga",
                    "link_oficial": link_oficial
                }
                if plan:
                    registro["plan_estudio"] = plan
                    registro["plan_fuente"] = link_oficial
                ies_data["carreras"].append(registro)
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo terminado! Se escanearon {contador} opciones del IES 9-004.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-004: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9004.json")
print("🎉 Archivo 'ies9004.json' listo para llevar al ensamblador.")