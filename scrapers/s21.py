import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import (carreras_por_link, es_duracion_real, extraer_duracion,
                           guardar_json, limpiar_texto, mejor_duracion)


# ---------------------------------------------------------------------------
# Plan de estudio
# ---------------------------------------------------------------------------
# S21 publica el plan de dos maneras según la carrera:
#  1. Pestañas por año: .study-plan__panel-wrapper con <h3> .. contenido en <ul>.
#  2. Acordeón: .ac-accordion-modalidad__wrap (año en el <h6>, materias en <ul>).
# El acordeón se repite en la página para modalidades y FAQ, así que sólo
# levantamos los títulos que son año/cuatrimestre o materias adicionales.
ORDEN = (r"primer|segundo|tercer|cuarto|quinto|sexto|s[eé]ptimo|octavo|"
         r"noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo")
RE_ANIO = re.compile(rf"^(?:{ORDEN})\s+a[nñ]o$", re.I)
RE_CUATRI = re.compile(rf"^(?:{ORDEN})\s+cuatrimestre$", re.I)
RE_NUMERO = re.compile(r"^(\d+)\s*[°º]\s*(a[nñ]o|cuatrimestre)$", re.I)
EXTRAS = {"materias adicionales", "extras", "materias electivas",
          "materias optativas", "optativas"}
ORDINALES = ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto",
             "séptimo", "octavo", "noveno", "décimo", "undécimo", "duodécimo"]


def _normalizar_tramo(titulo):
    """'2° año' -> 'Segundo año', para que quede igual que los otros paneles."""
    m = RE_NUMERO.match(titulo)
    if not m:
        return titulo
    n = int(m.group(1))
    if 1 <= n <= len(ORDINALES):
        return f"{ORDINALES[n - 1].capitalize()} {m.group(2).lower()}"
    return titulo


def _materias(ul):
    salida = []
    for li in ul.find_all("li"):
        t = limpiar_texto(li.get_text(" ", strip=True))
        if t and t not in salida:
            salida.append(t)
    return salida


def _tramos_tabs(sopa):
    tabs = [limpiar_texto(b.get_text(" ", strip=True))
            for b in sopa.select(".study-plan__tab")]
    tramos = []
    for i, w in enumerate(sopa.select(".study-plan__panel-wrapper")):
        h = w.select_one(".study-plan__content-title")
        anio = limpiar_texto(h.get_text(" ", strip=True)) if h else ""
        if not anio and i < len(tabs):
            anio = tabs[i]
        anio = _normalizar_tramo(anio)
        materias = []
        for ul in w.select(".study-plan__content ul"):
            for m in _materias(ul):
                if m not in materias:
                    materias.append(m)
        if anio and materias:
            tramos.append({"anio": anio, "materias": materias})
    return tramos


def _tramos_acordeon(sopa):
    anios, cuatris, extras = [], [], []
    for w in sopa.select(".ac-accordion-modalidad__wrap"):
        h = w.select_one(".ac-accordion-modalidad__title h6") \
            or w.select_one(".ac-accordion-modalidad__title")
        if not h:
            continue
        titulo = _normalizar_tramo(limpiar_texto(h.get_text(" ", strip=True)))
        bajo = titulo.lower()
        if not (RE_ANIO.match(titulo) or RE_CUATRI.match(titulo) or bajo in EXTRAS):
            continue
        materias = []
        for ul in w.select(".ac-accordion-modalidad__content ul"):
            for m in _materias(ul):
                if m not in materias:
                    materias.append(m)
        if not materias:
            continue
        tramo = {"anio": titulo, "materias": materias}
        if RE_ANIO.match(titulo):
            anios.append(tramo)
        elif RE_CUATRI.match(titulo):
            cuatris.append(tramo)
        else:
            extras.append(tramo)
    if anios:
        return anios + extras
    return cuatris + extras


def _tramos_details(sopa):
    """Plan publicado como <h5> por cuatrimestre/año con su <ul> debajo
    (las fichas HubSpot de Medicina usan div.plan-estudios-details)."""
    caja = sopa.select_one(".plan-estudios-details")
    if caja is None:
        return None
    tramos = []
    actual = None
    pendiente = []
    for el in caja.find_all(["h5", "h6", "ul"]):
        titular = limpiar_texto(el.get_text(" ", strip=True))
        if el.name in ("h5", "h6"):
            titulo = _normalizar_tramo(titular)
            bajo = titulo.lower()
            if RE_ANIO.match(titulo) or RE_CUATRI.match(titulo) or bajo in EXTRAS:
                if pendiente:
                    tramos.append({"anio": pendiente[0], "materias": pendiente[1]})
                pendiente = [titulo, []]
                actual = titulo
            continue
        materias = _materias(el)
        if not materias:
            continue
        if actual is not None:
            for m in materias:
                if m not in pendiente[1]:
                    pendiente[1].append(m)
    if pendiente:
        tramos.append({"anio": pendiente[0], "materias": pendiente[1]})
    tramos = [t for t in tramos if t["materias"]]
    return tramos or None


def extraer_plan(sopa):
    tramos = _tramos_tabs(sopa)
    if not tramos:
        tramos = _tramos_acordeon(sopa)
    if not tramos:
        tramos = _tramos_details(sopa) or []
    return tramos or None


print("🛠️ Encendiendo el escáner V10.1 para la Universidad Siglo 21 (S21)...")
print("🔍 Ajustando la caja de cambios (Paginación) y limpiando el filtro de nafta.\n")

carreras_viejas = carreras_por_link("s21.json")
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
            
            # La memoria se busca por LINK, no por nombre: el nombre de acá sale
            # del slug ("Contador Publico") y el guardado es el del <h1>
            # ("Contador Público"), así que nunca coincidían y cada corrida
            # re-scrapeaba todo — y lo que fallaba se perdía.
            guardada = carreras_viejas.get(link_real)
            if (guardada and es_duracion_real(guardada.get("duracion"))
                    and guardada.get("plan_estudio")):
                s21_data["carreras"].append(guardada)
                print(f"  ⏭️ Recuperada: {nombre_temporal[:35]} — {guardada['duracion']}")
            else:
                print(f"  🔍 Entrando a la fosa: {nombre_temporal[:35]}...")
                
                nombre_carrera = nombre_temporal
                duracion_texto = "Verificar en página oficial"
                modalidad_texto = "Presencial, Híbrida o Distancia" # Por si el escáner falla
                categoria = "Grado / Carrera"
                facultad = "S21"
                plan = None
                
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
                    # El regex de antes exigía "Duración:" con dos puntos. La web
                    # pasó a escribirlo en prosa ("tiene una duración aproximada
                    # de 4 años y medio") y dejó de matchear en las 23 carreras.
                    hallada = extraer_duracion(texto_completo)
                    if hallada:
                        duracion_texto = hallada
                        
                    # 3. Modalidad
                    match_mod = re.search(r'Modalidad:\s*([^\n]+)', texto_completo, re.IGNORECASE)
                    if match_mod:
                        modalidad_texto = match_mod.group(1).strip()
                        
                    # 4. Categoría (Grado o Pregrado)
                    if re.search(r'\bpregrado\b', texto_completo, re.IGNORECASE):
                        categoria = "Pregrado"

                    # 5. Plan de estudio (pestañas por año o acordeón)
                    plan = extraer_plan(sopa_det)

                except Exception as e:
                    pass

                nueva = {
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria,
                    # Si esta corrida no la consiguió pero el JSON ya tenía una
                    # buena, se conserva: nunca se degrada a placeholder.
                    "duracion": mejor_duracion(duracion_texto, guardada),
                    "modalidad": modalidad_texto,
                    "facultad": facultad,
                    "link_oficial": link_real
                }
                # Si la extracción falló pero ya teníamos un plan guardado, se
                # mantiene el viejo en vez de perderlo.
                plan = plan or (guardada or {}).get("plan_estudio")
                if plan:
                    nueva["plan_estudio"] = plan
                    nueva["plan_fuente"] = link_real
                s21_data["carreras"].append(nueva)
            id_global += 1
            contador += 1
            
    except Exception as e:
        print(f"⚠️ Error en página {pagina}: {e}")

# IDs correlativos: las carreras recuperadas conservan el id viejo mientras
# id_global avanza, y eso generaba ids repetidos (p.ej. 1011 tres veces).
for i, carrera in enumerate(s21_data["carreras"]):
    carrera["id"] = 1000 + i

print(f"\n✅ ¡Motor afinado! Se escanearon {contador} carreras de la Siglo 21.")

base_s21 = {"instituciones": [s21_data]}
guardar_json(base_s21, "s21.json")
print("🎉 Archivo 's21.json' listo para llevar al ensamblador.")