"""Universidad de la Defensa Nacional (UNDEF) - 9 carreras a distancia.

Las 9 carreras de la UNDEF se dictan a distancia y cada una pertenece a una
facultad distinta de la UNDEF (CRUC IUA, FIE, Facultad del Ejército, FADENA).
Algunas publican el plan en una página (IUA / ESG), otras en un PDF (FIE, FADENA).

Fuentes por carrera:
  * Tec. en Desarrollo de Aplicaciones Informáticas -> página IUA (cuatrimestral)
  * Tec. en Higiene y Seguridad en el Trabajo        -> PDF de la FIE (escaneado, OCR)
  * Lic. en Relaciones Internacionales                -> página ESG (tabla)
  * Contador Público / Lic. en Administración / Logística / RRHH -> página IUA (tabla)
  * Lic. en Ciberdefensa / Lic. en Gestión Pública    -> PDF de la FADENA (texto)
"""

import json
import re
import subprocess
import tempfile
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json, pedir_sopa, limpiar_texto

CABECERAS = {"User-Agent": "Mozilla/5.0"}

# Las 9 carreras cargadas a mano en la inyección original. Cada una lleva la
# página oficial de la carrera (link_oficial) y la URL de donde salió el plan
# (plan_fuente).
CARRERAS_UNDEF = [
    {
        "id": 1,
        "nombre_carrera": "Tecnicatura Universitaria en Desarrollo de Aplicaciones Informáticas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://www.iua.edu.ar/?page_id=6268",
        "plan_fuente": "https://www.iua.edu.ar/?page_id=6268",
        "fuente_plan": "cuatrimestral_iua",
    },
    {
        "id": 2,
        "nombre_carrera": "Tecnicatura en Higiene y Seguridad en el Trabajo",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ingeniería del Ejército",
        "link_oficial": "https://www.fie.undef.edu.ar/tecnicatura-higiene-y-seguridad-en-el-trabajo/",
        "plan_fuente": "https://www.fie.undef.edu.ar/wp-content/uploads/2026/06/PlanEstudioTecSeg.pdf",
        "fuente_plan": "higiene_ocr",
    },
    {
        "id": 3,
        "nombre_carrera": "Licenciatura en Relaciones Internacionales",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad del Ejército",
        "link_oficial": "https://fe.undef.edu.ar/esg/of_rrii.php",
        "plan_fuente": "https://fe.undef.edu.ar/esg/of_rrii.php",
        "fuente_plan": "tabla_esg",
    },
    {
        "id": 4,
        "nombre_carrera": "Contador Público",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://fca.iua.edu.ar/?page_id=3279",
        "plan_fuente": "https://fca.iua.edu.ar/?page_id=3279",
        "fuente_plan": "tabla_iua",
    },
    {
        "id": 5,
        "nombre_carrera": "Licenciatura en Administración",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://www.iua.edu.ar/?page_id=384",
        "plan_fuente": "https://www.iua.edu.ar/?page_id=384",
        "fuente_plan": "tabla_iua",
    },
    {
        "id": 6,
        "nombre_carrera": "Licenciatura en Logística",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://www.iua.edu.ar/?page_id=388",
        "plan_fuente": "https://www.iua.edu.ar/?page_id=388",
        "fuente_plan": "tabla_iua",
    },
    {
        "id": 7,
        "nombre_carrera": "Licenciatura en Recursos Humanos",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://www.iua.edu.ar/?page_id=386",
        "plan_fuente": "https://www.iua.edu.ar/?page_id=386",
        "fuente_plan": "tabla_iua",
    },
    {
        "id": 8,
        "nombre_carrera": "Licenciatura en Ciberdefensa",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad de la Defensa Nacional",
        "link_oficial": "https://undef.edu.ar/fadena/carreras-de-grado/licciberdefensa/",
        "plan_fuente": "https://undef.edu.ar/fadena/wp-content/uploads/2026/02/Licenciatura-en-Ciberdefensa.pdf",
        "fuente_plan": "pdf_fadena",
        "limites_anio": [12, 21, 29, 37],
    },
    {
        "id": 9,
        "nombre_carrera": "Licenciatura en Gestión Pública",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad de la Defensa Nacional",
        "link_oficial": "https://undef.edu.ar/fadena/carreras-de-grado/licgestionpublica/",
        "plan_fuente": "https://undef.edu.ar/fadena/wp-content/uploads/2026/02/Licenciatura-en-Gestion-Publica.pdf",
        "fuente_plan": "pdf_fadena",
        "limites_anio": [10, 16, 24, 31],
    },
]

# El PDF de Higiene y Seguridad de la FIE es una imagen escaneada: no tiene
# capa de texto. El plan se resolvió con OCR local (tesseract) del PDF oficial
# y quedó volcado aquí a mano con las materias exactas.
PLAN_HIGIENE_OCR = [
    {
        "anio": "1º año",
        "materias": [
            "Organización Industrial",
            "Seguridad Industrial I (Organización interna)",
            "Física General",
            "Psicología Laboral",
            "Química",
            "Pedagogía y Didáctica",
            "Seguridad Industrial II (Instalaciones eléctricas)",
            "Derecho del Trabajo",
        ],
    },
    {
        "anio": "2º año",
        "materias": [
            "Medicina del Trabajo",
            "Selección y capacitación de Personal",
            "Seguridad Industrial III (Máquinas y Herramientas)",
            "Análisis Estadístico",
            "Ambientes de Trabajo I (Ruidos y Vibraciones)",
            "Ambientes de Trabajo II (Iluminación y Color)",
            "Enfermedades Profesionales",
            "Seguridad Industrial IV (Incendios, Sistemas de Alarma, Evacuación)",
        ],
    },
    {
        "anio": "3º año",
        "materias": [
            "Ambientes de Trabajo III (Ventilación)",
            "Seguridad contra Accidentes en ámbitos no laborales y accidentología vial",
            "Estudio del Trabajo (Ergonomía)",
            "Seguridad Industrial V (Equipos y Elementos de Protección Personal)",
            "Trabajo Final Integrador",
        ],
    },
]

# Títulos intermedios que aparecen como filas dentro de las tablas de IUA y se
# cuelan como si fueran materias.
TITULOS_INTERMEDIOS = re.compile(r"^T[eé]cnico Universitario en\b")


def limpiar_materia(nombre):
    """Quita restos del layout (números de horas pegados) y normaliza."""
    nombre = re.sub(r"\s+\d+\s+\d+\s+\d+\s*$", "", nombre)
    nombre = re.sub(r"\s+\d+\s+\d+\s*$", "", nombre)
    nombre = re.sub(r"\s+\d+\s*$", "", nombre)
    return limpiar_texto(nombre)


def extraer_tabla_iua(url):
    """Plan en <table> de las páginas de IUA: columnas=años, bloques=1º/2º semestre."""
    sopa = pedir_sopa(url)
    if not sopa:
        return None
    for tabla in sopa.find_all("table"):
        texto = tabla.get_text(" ", strip=True)
        if "Primer Año" not in texto[:300] and "Primer A" not in texto[:300]:
            continue
        filas = tabla.find_all("tr")
        n_años = len([c.get_text(" ", strip=True) for c in filas[0].find_all(["td", "th"])])
        bloques = []
        actual = []
        for fila in filas[2:]:
            celdas = [c.get_text(" ", strip=True) for c in fila.find_all(["td", "th"])]
            if not celdas:
                continue
            if "SEMESTRE" in celdas[0].upper():
                bloques.append(actual)
                actual = []
            else:
                actual.append(celdas)
        if actual:
            bloques.append(actual)
        salida = []
        for i_año in range(n_años):
            materias = []
            for bloque in bloques:
                for fila in bloque:
                    if i_año < len(fila) and fila[i_año].strip():
                        materias.append(fila[i_año])
            salida.append({"anio": f"{i_año + 1}º año", "materias": materias})
        while salida and not salida[-1]["materias"]:
            salida.pop()
        return salida
    return None


def extraer_cuatrimestral_iua(url):
    """Plan en HTML plano de IUA (caso Tec. en Desarrollo de Aplicaciones)."""
    sopa = pedir_sopa(url)
    if not sopa:
        return None
    texto = sopa.get_text("\n", strip=True)
    inicio = texto.find("Plan de Estudio")
    if inicio < 0:
        return None
    nombre_año = {"PRIMER": 0, "SEGUNDO": 1, "TERCER": 2, "CUARTO": 3, "QUINTO": 4}
    bloques = re.split(
        r"\n(?=(?:PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO) AÑO – (?:PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO) CUATRIMESTRE)",
        texto[inicio:],
    )
    salida = []
    indice = {}
    for bloque in bloques:
        m = re.match(r"(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO) AÑO – [A-Z]+ CUATRIMESTRE\n", bloque)
        if not m:
            continue
        anio_ord = nombre_año[m.group(1)]
        lineas = [l.strip() for l in bloque[m.end():].split("\n") if l.strip()]
        materias = []
        j = 0
        while j < len(lineas) - 1:
            linea = lineas[j]
            if re.match(r"^[A-Z][A-Z0-9]{1,5}$", linea):
                siguiente = lineas[j + 1].replace("\xa0", " ").strip()
                if (
                    siguiente not in ("Cuatrimestral", "A Distancia", "–", "-")
                    and not re.match(r"^\d+$", siguiente)
                ):
                    materias.append(siguiente)
                    j += 2
                else:
                    j += 1
            else:
                j += 1
        if anio_ord not in indice:
            indice[anio_ord] = len(salida)
            salida.append({"anio": f"{anio_ord + 1}º año", "materias": []})
        salida[indice[anio_ord]]["materias"].extend(materias)
    while salida and not salida[-1]["materias"]:
        salida.pop()
    return salida


def extraer_tabla_esg(url):
    """Plan en <table> de la Escuela Superior de Guerra (Lic. en RRII)."""
    sopa = pedir_sopa(url)
    if not sopa:
        return None
    for tabla in sopa.find_all("table"):
        texto = tabla.get_text(" ", strip=True)
        if "Sistemas Políticos Comparados" not in texto:
            continue
        filas = []
        materias = []
        for fila in tabla.find_all("tr"):
            celdas = [c.get_text(" ", strip=True) for c in fila.find_all(["td", "th"])]
            if not celdas:
                continue
            if len(celdas) == 1 and re.match(r"[A-ZÁÉÍÓÚÑ]+ (Año)", celdas[0]):
                filas.append(("año", celdas[0]))
            elif len(celdas) == 4 and celdas[0].strip().isdigit():
                filas.append(("materia", int(celdas[0].strip()), celdas[1].strip()))
        # 4 años, materias correlativas: 1-6, 7-12, 13-20, 21-28.
        limites = [(6, 0), (12, 1), (20, 2), (28, 3)]
        salida = [{"anio": f"{i + 1}º año", "materias": []} for i in range(4)]
        for registro in filas:
            if registro[0] != "materia":
                continue
            num = registro[1]
            nombre = registro[2]
            for limite, i_año in limites:
                if num <= limite:
                    salida[i_año]["materias"].append(nombre)
                    break
        return salida
    return None


def extraer_pdf_fadena(url, limites_anio):
    """Plan en PDF de la FADENA: tabla con nº-materia, horas y correlatividad."""
    try:
        respuesta = requests.get(url, headers=CABECERAS, timeout=60)
        respuesta.raise_for_status()
    except Exception as error:
        print(f"  ⚠️ Error descargando {url}: {error}")
        return None
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(respuesta.content)
        ruta = tmp.name
    try:
        salida = subprocess.run(
            ["pdftotext", "-layout", ruta, "-"], capture_output=True, text=True, timeout=60
        )
        materias = []
        for linea in salida.stdout.split("\n"):
            texto_linea = linea.strip()
            if not texto_linea or "Totales" in texto_linea or "Título intermedio" in texto_linea:
                continue
            m = re.search(r"(\d+)\s*[-–]\s*(.+)", texto_linea)
            if m:
                nombre = limpiar_materia(m.group(2))
                materias.append((int(m.group(1)), nombre))
        salida_plan = []
        i = 0
        for i_año, limite in enumerate(limites_anio):
            parte = []
            while i < len(materias) and materias[i][0] <= limite:
                parte.append(materias[i][1])
                i += 1
            salida_plan.append({"anio": f"{i_año + 1}º año", "materias": parte})
        return salida_plan
    except Exception as error:
        print(f"  ⚠️ Error parseando {url}: {error}")
        return None
    finally:
        Path(ruta).unlink(missing_ok=True)


def cargar_plan(carrera):
    """Resuelve el plan_estudio de una carrera según su fuente."""
    fuente = carrera["fuente_plan"]
    if fuente == "tabla_iua":
        return extraer_tabla_iua(carrera["plan_fuente"])
    if fuente == "cuatrimestral_iua":
        return extraer_cuatrimestral_iua(carrera["plan_fuente"])
    if fuente == "tabla_esg":
        return extraer_tabla_esg(carrera["plan_fuente"])
    if fuente == "higiene_ocr":
        return PLAN_HIGIENE_OCR
    if fuente == "pdf_fadena":
        return extraer_pdf_fadena(carrera["plan_fuente"], carrera.get("limites_anio", []))
    return None


def filtrar_plan(plan):
    """Quita títulos intermedios que se cuelan como materias en las tablas de IUA."""
    if not plan:
        return plan
    for tramo in plan:
        tramo["materias"] = [
            m for m in tramo["materias"] if not TITULOS_INTERMEDIOS.match(m.strip())
        ]
    return plan


print("🛠️ Encendiendo inyección manual para la Universidad de la Defensa Nacional (UNDEF)...")
print("🔍 Set up: Inyectando las 9 carreras a distancia con enlace oficial.\n")

carreras = []
for base in CARRERAS_UNDEF:
    plan = filtrar_plan(cargar_plan(base))
    total = sum(len(t["materias"]) for t in plan) if plan else 0
    estado = f"✅ {len(plan)} años / {total} materias" if plan else "⚠️ sin plan"
    print(f"  > {base['nombre_carrera'][:60]} -> {estado}")
    registro = {
        "id": base["id"],
        "nombre_carrera": base["nombre_carrera"],
        "categoria": base["categoria"],
        "duracion": base["duracion"],
        "modalidad": base["modalidad"],
        "facultad": base["facultad"],
        "link_oficial": base["link_oficial"],
    }
    if plan:
        registro["plan_estudio"] = plan
        registro["plan_fuente"] = base["plan_fuente"]
    carreras.append(registro)

undef_data = {
    "id": 47,
    "nombre": "Universidad de la Defensa Nacional (UNDEF)",
    "nivel": "universidad",
    "gestion": "pública",
    "provincia": "Nacional (a distancia)",
    "contacto": {
        "telefono": "",
        "email": "informes@iua.edu.ar",
        "direccion": "Modalidad a distancia - Sede central Córdoba"
    },
    "carreras": carreras,
    "departamento": "A distancia",
}

guardar_json({"instituciones": [undef_data]}, "undef.json")
print("🎉 ¡Inyección perfecta! Se cargaron las 9 carreras de la UNDEF en el chasis.")