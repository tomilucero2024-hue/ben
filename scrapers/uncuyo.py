import re
import time

import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json, limpiar_texto


# El plan de estudios de la UNCuyo vive en una tabla: una fila "Plan de estudios:",
# después las materias. Algunas carreras (ingenierías) las agrupan por año y a veces
# por semestre; otras (artes, profesorados) publican una lista plana por secciones
# ("Espacios curriculares", "Asignaturas Específicas de la Carrera:").
PREFIJO_ORDINAL = {1: "1er", 2: "2do", 3: "3er", 4: "4to", 5: "5to",
                   6: "6to", 7: "7mo", 8: "8vo", 9: "9no", 10: "10mo"}
_RE_NUM = (r"primer[oa]?|1\s*(?:er|ro|°)|segund[oa]|2\s*(?:do|°)|"
           r"tercer[oa]?|3\s*(?:er|ro|°)|cuart[oa]|4\s*(?:to|°)|"
           r"quint[oa]|5\s*(?:to|°)|sext[oa]|6\s*(?:to|°)|"
           r"s[eé]ptim[oa]|7\s*(?:mo|°)|octav[oa]|8\s*(?:vo|°)|"
           r"noven[oa]|9\s*(?:no|°)|d[eé]cim[oa]|10\s*(?:mo|°)|"
           r"1[12]\s*°|\d{1,2}")
RE_TRAMO = re.compile(rf"^({_RE_NUM})\s+(a[nñ]o|semestre)\s*:?\s*$", re.I)
RE_PLAN_TITULO = re.compile(r"^(?:el\s+)?plan de estudios?:?$", re.I)
_PALABRAS = {"primer": 1, "segund": 2, "tercer": 3, "cuart": 4, "quint": 5,
             "sext": 6, "s[eé]ptim": 7, "octav": 8, "noven": 9, "d[eé]cim": 10}
ENCABEZADOS_SECCION = {"espacios curriculares", "asignaturas optativas",
                       "cursos optativos total", "cursos optativos",
                       "optativas", "optativa", "electivas", "electiva"}
PREFIJOS_RUIDO = ("para completar", "para obtener", "los/las estudiantes",
                  "los estudiantes", "el/la alumno", "el alumno", "los alumnos",
                  "la/el estudiante")


def _numero(token):
    digitos = re.findall(r"\d+", token)
    if digitos:
        return int(digitos[0])
    for prefijo, numero in _PALABRAS.items():
        if re.match(prefijo, token.strip().lower()):
            return numero
    return None


def _tabla_plan(sopa):
    for marca in sopa.find_all(['em', 'strong', 'b', 'p', 'h2', 'h3', 'h4', 'td']):
        if RE_PLAN_TITULO.match(limpiar_texto(marca.get_text(" ", strip=True))):
            tabla = marca.find_parent('table') or marca.find_next('table')
            if tabla is not None:
                return tabla
    return None


def extraer_plan(sopa):
    """Devuelve [{'anio': etiqueta, 'materias': [...]}] o None si no hay plan legible."""
    tabla = _tabla_plan(sopa)
    if tabla is None:
        return None

    anios, semestres, plano = {}, {}, []
    anio_ctx = sem_ctx = None
    for fila in tabla.find_all('tr'):
        celdas = fila.find_all(['td', 'th'])
        if not celdas:
            continue
        texto = limpiar_texto(" ".join(c.get_text(" ", strip=True) for c in celdas))
        if not texto or RE_PLAN_TITULO.match(texto):
            continue

        tramo = RE_TRAMO.match(texto)
        if tramo:
            numero = _numero(tramo.group(1))
            if numero is None:
                continue
            if tramo.group(2).lower().startswith("a"):
                anio_ctx, sem_ctx = numero, None
            else:
                sem_ctx = numero
            continue

        bajo = texto.lower()
        if bajo == "espacios curriculares":
            # Varias páginas repiten TODO el plan en una lista plana al final.
            # Al toparnos con ese bloque soltamos el contexto para no colgar esas
            # materias (duplicadas) del último año/semestre.
            anio_ctx = sem_ctx = None
            continue
        if (bajo.endswith(":") or bajo in ENCABEZADOS_SECCION
                or len(texto) > 90 or bajo.startswith(PREFIJOS_RUIDO)):
            continue

        if anio_ctx is not None:
            anios.setdefault(anio_ctx, [])
            if texto not in anios[anio_ctx]:
                anios[anio_ctx].append(texto)
        elif sem_ctx is not None:
            semestres.setdefault(sem_ctx, [])
            if texto not in semestres[sem_ctx]:
                semestres[sem_ctx].append(texto)
        elif texto not in plano:
            plano.append(texto)

    if sum(len(m) for m in anios.values()) >= 4:
        return [{"anio": f"{PREFIJO_ORDINAL.get(n, str(n) + '°')} año", "materias": anios[n]}
                for n in sorted(anios) if anios[n]]
    if sum(len(m) for m in semestres.values()) >= 4:
        return [{"anio": f"{PREFIJO_ORDINAL.get(n, str(n) + '°')} semestre",
                 "materias": semestres[n]}
                for n in sorted(semestres) if semestres[n]]
    if len(plano) >= 4:
        return [{"anio": "Plan de estudios", "materias": plano}]
    return None


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
            
            viejo = carreras_viejas.get(nombre, {})
            tiene_duracion = viejo.get("duracion") not in [None, "A confirmar", ""]

            if tiene_duracion and viejo.get("plan_estudio"):
                uncuyo_data["carreras"].append(viejo)
                print(f"  ⏭️ Recuperada: {nombre[:30]}...")
            else:
                href = enlace.get('href', '')
                link_real = href if href.startswith('http') else "https://www.uncuyo.edu.ar" + href
                span_facultad = tarjeta.find('span', class_='facultad')
                fac = span_facultad.text.strip() if span_facultad else "UNCuyo"
                
                print(f"  🔍 Buscando duración y plan de: {nombre[:30]}...")
                duracion_texto = viejo.get("duracion") if tiene_duracion else "A confirmar"
                plan = None
                
                try:
                    time.sleep(0.5) # Pausa vital para no saturar el servidor
                    resp_det = requests.get(link_real, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                    sopa_det = BeautifulSoup(resp_det.text, 'html.parser')

                    plan = extraer_plan(sopa_det)

                    if not tiene_duracion:
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
                except Exception:
                    pass # Si un link falla, sigue viaje
                
                carrera = {
                    "id": id_global,
                    "nombre_carrera": nombre,
                    "categoria": "Grado / Carrera",
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "facultad": fac,
                    "link_oficial": link_real
                }
                if plan:
                    carrera["plan_estudio"] = plan
                    carrera["plan_fuente"] = link_real
                uncuyo_data["carreras"].append(carrera)
            id_global += 1
except Exception as e:
    print(f"⚠️ Error general en UNCuyo: {e}")

base_uncuyo = {"instituciones": [uncuyo_data]}
guardar_json(base_uncuyo, "uncuyo.json")
print("\n🎉 UNCuyo terminada y guardada en 'uncuyo.json'.")