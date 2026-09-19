import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


# Plan del IESVU: título "Plan de estudios" + un subtítulo por año + las materias
# debajo. El subtítulo cambia de carrera a carrera: <p> o <h3>, en palabras
# ("Primer año", "PRIMER AÑO") o en números ("1er Año", "2do Año").
RE_ANIO = re.compile(
    r"^(primer|segundo|tercer|cuarto|quinto|sexto|[1-6])(?:er|do|to|mo|ro|°|º)?\s*a[ñn]o\b",
    re.I,
)
RE_PERIODO = re.compile(
    r"\s*[–-]\s*(\d+\s*[°º]?\s*(cuatrimestre|semestre)|anual|cuatrimestral|semestral)\s*$",
    re.I,
)
# Algunas carreras publican módulos numerados ("1- Sistemas mecánicos") y debajo
# las competencias de cada módulo en una <ul>. Ahí la materia es el módulo, no
# cada competencia.
RE_MODULO = re.compile(r"^\d+\s*[-.)]\s*(.+)$")
MAPA_ANIO = {"primer": "1", "segundo": "2", "tercer": "3", "cuarto": "4", "quinto": "5"}


def _numero_de_anio(texto):
    coincidencia = RE_ANIO.match(texto)
    if not coincidencia:
        return None
    bruto = coincidencia.group(1).lower()
    return bruto if bruto.isdigit() else MAPA_ANIO.get(bruto)


def _materias_de_tabla(tabla):
    """Módulos de las tablas "Módulo N° | Denominación del Módulo"."""
    materias = []
    for fila in tabla.find_all("tr"):
        celdas = fila.find_all(["td", "th"])
        if len(celdas) < 2 or not re.fullmatch(r"\d+", celdas[0].get_text(" ", strip=True)):
            continue
        nombre = re.sub(r"\s+", " ", celdas[1].get_text(" ", strip=True)).strip()
        if nombre:
            materias.append(nombre)
    return materias


def extraer_plan(sopa):
    """Devuelve [{"anio": "1º año", "materias": [...]}] del bloque de plan."""
    inicio = None
    for encabezado in sopa.find_all(["h2", "h3"]):
        if re.search(r"plan de estudios", encabezado.get_text(" ", strip=True), re.I):
            inicio = encabezado
            break
    if inicio is None:
        return None
    plan = []
    actual = None
    modo_modulos = False
    for elemento in inicio.find_all_next(["h2", "h3", "p", "ul", "ol", "table"]):
        texto = re.sub(r"\s+", " ", elemento.get_text(" ", strip=True))
        numero = _numero_de_anio(texto)
        if numero:
            actual = {"anio": numero + "º año", "materias": []}
            plan.append(actual)
            modo_modulos = False
            continue
        if elemento.name in ("h2", "h3"):
            if actual is not None:
                break
            continue
        if elemento.name == "p":
            modulo = RE_MODULO.match(texto)
            if modulo and actual is not None:
                modo_modulos = True
                nombre = modulo.group(1).strip()
                if nombre:
                    actual["materias"].append(nombre)
            continue
        if elemento.name in ("ul", "ol") and actual is not None:
            if modo_modulos:
                continue
            for item in elemento.find_all("li", recursive=False):
                materia = re.sub(r"\s+", " ", item.get_text(" ", strip=True))
                materia = RE_PERIODO.sub("", materia).strip()
                if materia:
                    actual["materias"].append(materia)
            continue
        if elemento.name == "table" and actual is not None and not modo_modulos:
            actual["materias"].extend(_materias_de_tabla(elemento))
    return [tramo for tramo in plan if tramo["materias"]] or None


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
                
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("plan_estudio"):
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"    ✔️ Recuperada de memoria: {nombre_carrera}")
            else:
                print(f"    🔍 Analizando a fondo: {nombre_carrera}...")
                
                modalidad_extraida = "A confirmar"
                duracion_extraida = "A confirmar"
                plan_estudio = None
                
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

                    plan_estudio = extraer_plan(sopa_adentro)
                            
                except Exception as e_interno:
                    print(f"      ⚠️ No se pudo leer el interior de {nombre_carrera}: {e_interno}")
                
                if not plan_estudio:
                    plan_estudio = (carreras_viejas.get(nombre_carrera) or {}).get("plan_estudio")

                registro = {
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_extraida,
                    "modalidad": modalidad_extraida,
                    "turno": "A confirmar",
                    "facultad": "IESVU (IES 9-015)",
                    "link_oficial": link_oficial
                }
                if plan_estudio:
                    registro["plan_estudio"] = plan_estudio
                    registro["plan_fuente"] = link_oficial
                ies_data["carreras"].append(registro)
                id_global += 1
                contador += 1
                
                time.sleep(1) 
                
    print(f"\n✅ ¡Escáner rectificado! Se extrajeron {contador} opciones del IESVU limpitas.")

except Exception as e:
    print(f"⚠️ Falla mecánica principal en IESVU: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9015.json")
print("🎉 Archivo 'ies9015.json' guardado correctamente.")