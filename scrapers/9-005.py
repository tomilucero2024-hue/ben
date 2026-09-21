import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json

import json as _json
import re as _re

def extraer_plan_estudio(sopa):
    """Extrae el plan de estudio real en texto cuando la pagina oficial lo
    publica como texto: ya sea h3 (\"📘 Primer Año\" …) + <ul> de materias, o
    una tabla con filas separadoras (\"Primer año:\"). Si el plan solo viene
    como imagen o PDF, devuelve None (no se inventa)."""
    plan = []
    for h in sopa.find_all(['h3', 'h4']):
        txt = h.get_text(' ', strip=True)
        if not _re.search(r'(A[ñn]o|AÑO|año|semestre|Semestre|cuatrimestre|Cuatrimestre)', txt):
            continue
        ul = h.find_next('ul')
        if not ul:
            continue
        materias = [li.get_text(' ', strip=True).strip() for li in ul.find_all('li')]
        materias = [m for m in materias if m and m.lower() not in ('', 'menú')]
        if materias:
            plan.append({'anio': txt, 'materias': materias})
    if plan:
        return plan

    # Tabla con filas separadoras del tipo "Primer año:" seguidas de materias
    patron_anio = _re.compile(r'^(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|1er|2do|3ro|4to)\s*a[ñn]o\s*:?\s*$', _re.I)
    for tabla in sopa.find_all('table'):
        plan_tabla = []
        for tr in tabla.find_all('tr'):
            celdas = [c.get_text(' ', strip=True).strip() for c in tr.find_all(['td', 'th'])]
            celdas = [c for c in celdas if c]
            if not celdas:
                continue
            texto = ' '.join(celdas).strip()
            if patron_anio.match(texto):
                plan_tabla.append({'anio': texto.rstrip(':').strip(), 'materias': []})
            elif plan_tabla:
                plan_tabla[-1]['materias'].extend(celdas)
        if plan_tabla and any(a['materias'] for a in plan_tabla):
            return plan_tabla
    return None


print("🛠️ Encendiendo el escáner V15 para IES 9-005...")
print("🔍 Set up: Profesorados (4 años) y Formación Profesional (1.5 años) detectados.\n")

carreras_viejas = carreras_guardadas("ies9005.json")
ies_data = {
    "id": 15,
    "nombre": "IES 9-005",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0263-4442371",
        "email": "ens9005@infd.edu.ar",
        "direccion": "San Martín y Godoy Cruz, Junín, Mendoza"
    },
    "carreras": []
}

url_base = "https://ens9005-infd.mendoza.edu.ar/sitio/"
id_global = 1500 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a la página principal: {url_base}")
    req = requests.get(url_base, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # Buscamos el menú de navegación principal (Captura 1)
    menu = sopa.find('nav', id='site-navigation') or sopa
    enlaces = menu.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        nombre_carrera = a.get_text(separator=' ', strip=True)
        nombre_lower = nombre_carrera.lower()
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos para asegurar que sean links internos del sitio educativo
        if "/sitio/" not in link_oficial or "mendoza.edu.ar" not in link_oficial:
            continue
            
        # Identificamos si es un profesorado o una formación profesional
        if "profesorado" in nombre_lower or "formacion-profesional" in link_oficial.lower() or "apicultura" in nombre_lower or "software" in nombre_lower:
            carreras_procesadas.add(link_oficial)
            
            _vieja = carreras_viejas.get(nombre_carrera)
            if _vieja and _vieja.get("duracion") not in ["A confirmar"] and (_vieja.get("plan_estudio") or _vieja.get("plan_fuente")):
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Analizando: {nombre_carrera[:35]}...")
                
                # Asignamos categoría y duración según corresponda
                if "formacion-profesional" in link_oficial.lower() or "formación" in nombre_lower:
                    categoria_actual = "Formación Profesional"
                    duracion_texto = "1 año y medio"
                else:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                    
                modalidad_texto = "Presencial"
                turno_texto = "A confirmar"
                plan_extraido = None
                
                try:
                    time.sleep(0.4)
                    req_det = requests.get(link_oficial, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(req_det.text, 'html.parser')
                    
                    texto_completo = sopa_det.get_text(separator=' ')
                    match_turno = re.search(r'Turno[s]?:\s*([^\n\.]+)', texto_completo, re.IGNORECASE)
                    if match_turno:
                        turno_texto = match_turno.group(1).strip()
                    
                    plan_extraido = extraer_plan_estudio(sopa_det)
                except Exception as e:
                    pass
                    
                print(f"   ✨ Ficha -> {categoria_actual} | Duración: [{duracion_texto}] | Plan: {'texto' if plan_extraido else 'oficial ↗'}")
                
                ficha = {
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_texto,
                    "modalidad": modalidad_texto,
                    "turno": turno_texto,
                    "facultad": "IES 9-005",
                    "link_oficial": link_oficial,
                    "plan_fuente": link_oficial
                }
                if plan_extraido:
                    ficha["plan_estudio"] = plan_extraido
                ies_data["carreras"].append(ficha)
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo terminado! Se escanearon {contador} opciones del IES 9-005.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-005: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9005.json")
print("🎉 Archivo 'ies9005.json' guardado con éxito.")