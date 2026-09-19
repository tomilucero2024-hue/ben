"""Universidad Católica Argentina (UCA) - Sede Mendoza.

uca.edu.ar es una app Angular (CSR): el HTML que devuelve `requests` es solo el
shell de 117 KB sin datos. El contenido real lo sirve su backend en
https://wadmin.uca.edu.ar:

  * /api/career/search/?locale=es  -> todas las carreras (nombre, duración, sede, linkCareer)
  * /api/studyplan/?q=<slug>&locale=es -> plan de estudios en HTML

Aprovechamos esas dos rutas: la búsqueda para duración/enlace oficial y el
studyplan para las materias. Las páginas de plan visibles son
https://uca.edu.ar/es{facultad}/carrera-de-grado/{slug}/plan-de-estudio.
"""

import re

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json, limpiar_texto

API = "https://wadmin.uca.edu.ar"
CABECERAS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# Las 17 carreras de la Facultad de Humanidades y Ciencias Económicas (Mendoza).
# El slug es el último tramo de linkCareer y es la clave para pedir el plan.
CARRERAS = [
    {"id": 800, "nombre_carrera": "Ciclo de Licenciatura en Comunicación Digital e Interactiva",
     "slug": "ciclo-de-licenciatura-en-comunicacion-digital-e-interactiva",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 801, "nombre_carrera": "Contador Público",
     "slug": "contador-publico-1",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 802, "nombre_carrera": "Licenciatura en Administración de Empresas",
     "slug": "administracion-de-empresas",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 803, "nombre_carrera": "Licenciatura en Ciencias del Comportamiento",
     "slug": "licenciatura-en-ciencias-del-comportamiento",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 804, "nombre_carrera": "Licenciatura en Comunicación Digital e Interactiva",
     "slug": "comunicacion-digital-e-interactiva-1",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 805, "nombre_carrera": "Licenciatura en Economía Empresarial",
     "slug": "licenciatura-en-economia-empresarial",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 806, "nombre_carrera": "Licenciatura en Gestión de Negocios Digitales",
     "slug": "licenciatura-en-gestion-de-negocios-digitales",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 807, "nombre_carrera": "Licenciatura en Gestión del Liderazgo y Desarrollo Organizacional",
     "slug": "licenciatura-en-gestion-del-liderazgo-y-desarrollo-organizacional",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 808, "nombre_carrera": "Licenciatura en Marketing",
     "slug": "marketing",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 809, "nombre_carrera": "Licenciatura en Psicología",
     "slug": "psicologia",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 810, "nombre_carrera": "Licenciatura en Psicopedagogía",
     "slug": "psicopedagogia",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 811, "nombre_carrera": "Licenciatura en Relaciones Internacionales",
     "slug": "relaciones-internacionales",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 812, "nombre_carrera": "Martillero Público, Corredor (Inmobiliario y Mobiliario), Administrador de Consorcios y Tasador",
     "slug": "martillero-publico-corredor-inmobiliario-y-mobiliario-administrador-de-consorcios-y-tasador",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 813, "nombre_carrera": "Profesorado Universitario de Educación Inicial",
     "slug": "educacion-inicial",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 814, "nombre_carrera": "Profesorado Universitario de Educación Primaria",
     "slug": "educacion-primaria",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Humanidades y Ciencias Económicas"},
    {"id": 815, "nombre_carrera": "Profesorado Universitario en Educación Física y Deportes",
     "slug": "profesorado-universitario-en-educacion-fisica-y-deportes",
     "categoria": "Grado / Carrera", "modalidad": "Presencial",
     "facultad": "UCA - Facultad de Humanidades y Ciencias Económicas"},
    {"id": 816, "nombre_carrera": "Ciclo de Licenciatura en Higiene y Seguridad, Calidad y Medio Ambiente",
     "slug": "licenciatura-en-higiene-y-seguridad-en-el-trabajo-calidad-y-medio-ambiente-ciclo-de-complementacion-curricular-ccc",
     "categoria": "Grado / Carrera", "modalidad": "A Distancia",
     "facultad": "UCA - Facultad de Humanidades y Ciencias Económicas"},
]

YEAR_RE = re.compile(r"^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO)\s+A[ÑN]\s*O\b", re.I)
SEM_RE = re.compile(r"^\d+\s*[°º]?\s*(semestre|cuatrimestre)\b", re.I)
SKIP_RE = re.compile(
    r"^(los primeros|un seminario|las tem|materias en contra|cuatro talleres|requisito)",
    re.I,
)
TITULO_RE = re.compile(r"^t[íi]tulo\s+(de grado|intermedio)", re.I)
PARTE_AÑO_RE = re.compile(r"^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO)\s+A[ÑN]$", re.I)
MAPA_ANIO = {"PRIMER": "1º", "SEGUNDO": "2º", "TERCER": "3º", "CUARTO": "4º", "QUINTO": "5º", "SEXTO": "6º"}


def unir_lineas_partidas(lineas):
    """El PDF/HTML a veces corta 'CUARTO AÑO' en 'CUARTO AÑ' + 'O'; las une."""
    salida = []
    i = 0
    while i < len(lineas):
        linea = lineas[i]
        if i + 1 < len(lineas) and PARTE_AÑO_RE.match(linea.strip()) and lineas[i + 1].strip() == "O":
            salida.append(linea.strip() + "O")
            i += 2
            continue
        salida.append(linea.strip())
        i += 1
    return salida


def extraer_plan(body):
    """Convierte el HTML del plan en [{"anio": "1º año", "materias": [...]}]."""
    sopa = BeautifulSoup(body, "html.parser")
    anios = []

    def anio(nombre):
        for a in anios:
            if a["anio"] == nombre:
                return a
        a = {"anio": nombre, "materias": []}
        anios.append(a)
        return a

    actual = None
    for bloque in sopa.find_all(["p", "ul", "ol", "h1", "h2", "h3", "h4", "h5"]):
        # Evita procesar un bloque anidado dentro de otro ya procesado.
        if bloque.find_parent(["p", "ul", "ol"]) is not None:
            continue
        if bloque.name in ("ul", "ol"):
            lineas = [
                x
                for li in bloque.find_all("li")
                for x in li.get_text("\n", strip=True).split("\n")
                if x.strip()
            ]
        else:
            lineas = [x for x in bloque.get_text("\n", strip=True).split("\n") if x.strip()]
        for linea in unir_lineas_partidas(lineas):
            norm = re.sub(r"\s+", " ", linea).strip()
            m = YEAR_RE.match(norm)
            if m:
                actual = anio(MAPA_ANIO[m.group(1).upper()] + " año")
                continue
            if SEM_RE.match(norm) or SKIP_RE.match(norm) or TITULO_RE.match(norm):
                continue
            if norm.startswith("*") or norm.endswith("*"):
                continue
            if actual is None:
                actual = anio("1º año")
            actual["materias"].append(limpiar_texto(norm))
    return anios


def buscar_carreras():
    """Devuelve un mapa slug -> carrera desde la búsqueda oficial de la UCA."""
    try:
        respuesta = requests.get(f"{API}/api/career/search/?locale=es", headers=CABECERAS, timeout=40)
        respuesta.raise_for_status()
        datos = respuesta.json().get("data") or []
    except Exception as error:
        print(f"  ⚠️ No se pudo consultar la búsqueda de carreras: {error}")
        return {}
    mapa = {}
    for grupo in datos:
        for carrera in grupo.get("career", []):
            link = carrera.get("linkCareer") or ""
            if not link.startswith("/facultades/facultad-de-humanidades-y-ciencias-economicas"):
                continue
            slug = link.rstrip("/").split("/")[-1]
            mapa.setdefault(slug, carrera)
    return mapa


def traer_plan(slug):
    try:
        respuesta = requests.get(f"{API}/api/studyplan/?q={slug}&locale=es", headers=CABECERAS, timeout=40)
        respuesta.raise_for_status()
        datos = respuesta.json().get("data")
    except Exception as error:
        print(f"    ⚠️ Error pidiendo el plan de '{slug}': {error}")
        return None
    if not datos:
        return None
    items = datos[0][0].get("studyPlanItems") or []
    if not items:
        return None
    return extraer_plan(items[0]["body"])


print("🛠️ Encendiendo el escáner V8 para la UCA...")
print("⚠️ Ojo: Detectamos Angular. Usando la API del backend (wadmin.uca.edu.ar).\n")

api = buscar_carreras()
print(f"📡 Carreras de Mendoza en la API: {len(api)}\n")

carreras = []
for base in CARRERAS:
    info = api.get(base["slug"]) or {}
    link = info.get("linkCareer")
    link_oficial = ("https://uca.edu.ar/es" + link) if link else "https://uca.edu.ar/es/ingreso"
    duracion = info.get("duracion") or "Verificar en web oficial"
    plan = traer_plan(base["slug"])
    registro = {
        "id": base["id"],
        "nombre_carrera": base["nombre_carrera"],
        "categoria": base["categoria"],
        "duracion": duracion,
        "modalidad": base["modalidad"],
        "facultad": base["facultad"],
        "link_oficial": link_oficial,
    }
    if plan:
        registro["plan_estudio"] = plan
        registro["plan_fuente"] = link_oficial.rstrip("/") + "/plan-de-estudio"
        total = sum(len(a["materias"]) for a in plan)
        print(f"  ✅ {base['nombre_carrera'][:52]:54s} {len(plan)} años / {total} materias")
    else:
        print(f"  ⚠️ {base['nombre_carrera'][:52]:54s} sin plan")
    carreras.append(registro)

uca_data = {
    "id": 8,
    "nombre": "Universidad Católica Argentina (UCA)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4429400",
        "email": "ingresomendoza@uca.edu.ar",
        "direccion": "Uruguay 750, Godoy Cruz",
    },
    "carreras": carreras,
    "departamento": "Godoy Cruz",
}

guardar_json({"instituciones": [uca_data]}, "uca.json")
print(f"\n🎉 UCA lista: {len(carreras)} carreras de Mendoza.")