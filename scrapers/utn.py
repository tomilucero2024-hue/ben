import json
import os
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Arrancando el escáner exclusivo de la UTN...")

archivo_utn = DIR_DATOS / "utn.json"
carreras_viejas = {}

# Leemos la memoria para no pisar si ya editaste algo
if os.path.exists(archivo_utn):
    try:
        with open(archivo_utn, "r", encoding="utf-8") as f:
            datos = json.load(f)
            for c in datos["instituciones"][0].get("carreras", []):
                carreras_viejas[c["nombre_carrera"]] = c
    except:
        pass

utn_data = {
    "id": 1,
    "nombre": "UTN Facultad Regional Mendoza",
    "carreras": []
}

urls_utn = [
    {"url": "https://www.frm.utn.edu.ar/ingenierias/", "cat": "Ingeniería"},
    {"url": "https://www.frm.utn.edu.ar/tecnicaturas-superiores/", "cat": "Tecnicatura"}
]

# 🧹 EL FILTRO DEFINITIVO: solo mata los títulos-menu exactos que se cuelan
# ("Información", "Encuestas", ...). MUY importante: matchear por igualdad, no
# por "está adentro", porque "información" vive adentro de nombres legítimos
# como "Ingeniería en Sistemas de Información" — si no, la carrera desaparece.
basura = {
    "información", "encuestas", "tecnicaturas", "ingenierías", "e-mail", "@",
    "facebook", "copyright", "diseño", "trámites", "canales", "contacto",
    "leer más", "rodríguez", "república", "volver a la oferta educativa",
    "canales digitales", "copyright 2026", "diseño eugenia nassivera :: power by",
}

def normalizar_utn(texto):
    """Mayúsculas + un solo espacio: compara "SISTEMAS de INFORMACIÓN" == "SISTEMAS DE INFORMACIÓN"."""
    return re.sub(r"\s+", " ", (texto or "").strip()).upper()

def duracion_a_anios(texto):
    """'5 años' -> 5.0, '5 1/2 años' -> 5.5, '2 años y medio' -> 2.5, '3 años' -> 3, o None."""
    if not texto:
        return None
    t = texto.lower()
    if "1/2" in t or " y medio" in t or " y media" in t:
        base = re.search(r"(\d+)\b", t)
        return (float(base.group(1)) + 0.5) if base else None
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:años?|a\so)", t)
    if not m:
        m = re.search(r"(\d+(?:[.,]\d+)?)", t)
    return float(m.group(1)) if m else None

carreras_viejas_por_nombre = {normalizar_utn(n): c for n, c in carreras_viejas.items()}

id_global = 1

for item in urls_utn:
    print(f"📍 Revisando: {item['cat']}s")
    try:
        req = requests.get(item["url"], timeout=15)
        sopa = BeautifulSoup(req.text, "html.parser")
        bloques = sopa.find_all("div", class_="elementor-widget-wrap")
        
        for bloque in bloques:
            titulo = bloque.find("h2", class_="elementor-heading-title")
            if titulo:
                nombre = titulo.text.strip()
                nombre_lower = nombre.lower()
                clave = normalizar_utn(nombre)

                # Verificamos si es un menú infiltrado (igualdad exacta)
                es_basura = nombre_lower.strip() in basura
                
                if not es_basura and nombre:
                    vieja = carreras_viejas_por_nombre.get(clave)
                    if vieja and vieja.get("duracion") not in ["A confirmar", ""]:
                        utn_data["carreras"].append(vieja)
                        print(f"  ⏭️ Recuperada de memoria: {nombre}")
                    else:
                        enlace = bloque.find("a")
                        link_real = enlace["href"] if enlace and "href" in enlace.attrs else item["url"]
                        
                        # Intento de Deep Scraping rápido para UTN
                        duracion = "A confirmar"
                        try:
                            resp_det = requests.get(link_real, timeout=10)
                            sopa_det = BeautifulSoup(resp_det.text, "html.parser")
                            for p in sopa_det.find_all(['p', 'div', 'li']):
                                texto = p.text.lower()
                                if "año" in texto and len(p.text) < 50:
                                    # Sacamos la etiqueta ("DURACIÓN", tabs, saltos de línea)
                                    # y dejamos solo el valor, ej. "5 años".
                                    limpio = re.sub(r'(?i)^duraci[oó]n\s*', '', p.text.strip())
                                    duracion = re.sub(r'\s+', ' ', limpio).strip()
                                    break
                        except:
                            pass

                        utn_data["carreras"].append({
                            "id": id_global,
                            "nombre_carrera": nombre,
                            "categoria": item["cat"],
                            "duracion": duracion,
                            "modalidad": "Presencial",
                            "facultad": "UTN FRM",
                            "link_oficial": link_real
                        })
                        print(f"  ✅ Agregada limpia: {nombre} | Duración: {duracion[:15]}")
                    id_global += 1
    except Exception as e:
        print(f"⚠️ Falla en UTN: {e}")

base_utn = {"instituciones": [utn_data]}
guardar_json(base_utn, "utn.json")
print("\n🎉 UTN terminada. Todo guardado impecable en 'utn.json'.")


# ---------------------------------------------------------------------------
# 📚 PLANES DE ESTUDIO: materias año por año
# ---------------------------------------------------------------------------
# Cada carrera UTN publica su plan en una página aparte
# (frm.utn.edu.ar/plan-de-estudio-<carrera>/). El formato es uniforme:
# títulos "h2" con el año ("primer año plan 2023") y debajo una tabla con
# código, materia, régimen y correlativas. Convertimos eso al contrato único
# de BEN: una lista de años, cada uno con sus materias.

# Patrón de espalda: si el menú de la carrera no muestra el link al plan,
# probamos estas URLs conocidas (el prefijo varía por carrera).
PLANES_CONOCIDOS = {
    "INGENIERÍA CIVIL": "https://frm.utn.edu.ar/plan-de-estudio-ing-civil/",
    "INGENIERÍA ELECTROMECÁNICA": "https://frm.utn.edu.ar/plan-de-estudio-ing-electromecanica/",
    "INGENIERÍA ELECTRÓNICA": "https://frm.utn.edu.ar/plan-de-estudio-ing-electronica/",
    "INGENIERÍA QUÍMICA": "https://frm.utn.edu.ar/plan-de-estudio-ing-quimica/",
    "INGENIERÍA EN TELECOMUNICACIONES": "https://frm.utn.edu.ar/plan-de-estudio-de-ing-en-telecomunicaciones/",
    "INGENIERÍA EN SISTEMAS DE INFORMACIÓN": "https://frm.utn.edu.ar/plan-de-estudio-ing-sistemas-de-informacion/",
    "INGENIERÍA EN MINAS": "https://frm.utn.edu.ar/plan-de-estudio-ing-minas/",
    "Enología": "https://frm.utn.edu.ar/plan-de-estudio-tec-univ-enologia/",
    "Gestión de Empresas Hoteleras": "https://frm.utn.edu.ar/plan-de-estudio-tec-univ-gestion-de-empresas-hoteleras/",
    "Gestión de Empresas Turísticas": "https://frm.utn.edu.ar/plan-de-estudio-tec-univ-gestion-de-empresas-turisticas/",
    "Higiene y Seguridad": "https://frm.utn.edu.ar/plan-de-estudio-tec-univ-higiene-y-seguridad/",
}

# "primer año", "segundo año", "tercer año", ... -> "1er año", "2do año", ...
ORDINALES = {
    "primer": "1er", "primero": "1er", "segundo": "2do", "tercer": "3er",
    "tercero": "3er", "cuarto": "4to", "quinto": "5to", "sexto": "6to",
    "s[eé]ptimo": "7mo", "octavo": "8vo", "noveno": "9no", "d[eé]cimo": "10mo",
}
RX_ANIO = re.compile(r"^\s*(" + "|".join(ORDINALES) + r")\s+a[ñn]o\b")

# En "Higiene y Seguridad" el régimen y las correlativas vienen con guiones
# ("– – –") que son ruido, no datos.
BASURA_REGIMEN = {"– – –", "- - -", "–", "-", ""}


def extraer_plan(url_plan):
    """Devuelve {plan_estudio, plan_fuente} o None si la página no reúne datos."""
    try:
        req = requests.get(url_plan, timeout=20)
        req.raise_for_status()
    except Exception as error:
        print(f"  ⚠️ No se pudo leer el plan {url_plan}: {error}")
        return None

    sopa = BeautifulSoup(req.text, "html.parser")
    anios = []
    for titular in sopa.find_all(["h2", "h3", "h4"]):
        texto = " ".join(titular.get_text(" ", strip=True).split()).lower()
        m = RX_ANIO.match(texto)
        if not m:
            continue
        # Normalizamos el ordinal y armamos la etiqueta bonita ("1er año").
        palabra = m.group(1)
        for clave, valor in ORDINALES.items():
            if re.fullmatch(clave, palabra):
                etiqueta = valor
                break
        etiqueta = f"{etiqueta} año"

        tabla = titular.find_next("table")
        if not tabla:
            continue
        materias = []
        filas = tabla.find_all("tr")
        if not filas:
            continue
        # La primera fila suele ser el encabezado (CÓDIGO / NOMBRE / RÉGIMEN ...).
        celdas_encabezado = " ".join(td.get_text(" ", strip=True) for td in filas[0].find_all(["th", "td"])).lower()
        empieza_datos = 1 if "código" in celdas_encabezado or "codigo" in celdas_encabezado else 0
        for fila in filas[empieza_datos:]:
            celdas = [td.get_text(" ", strip=True) for td in fila.find_all(["th", "td"])]
            # Quitamos celdas vacías para no desfasar los índices.
            celdas = [c for c in celdas if c]
            if not celdas:
                continue
            # Las filas válidas arrancan con el código numérico de la materia;
            # si no, es una fila de separación o una tabla ajena al plan.
            if not re.fullmatch(r"\d+", celdas[0]):
                continue
            nombre = celdas[1] if len(celdas) >= 2 else celdas[0]
            regimen = celdas[2] if len(celdas) >= 3 else ""
            materia = nombre
            if regimen and regimen not in BASURA_REGIMEN:
                materia = f"{nombre} ({regimen})"
            if materia and materia not in materias:
                materias.append(materia)
        if materias:
            anios.append({"anio": etiqueta, "materias": materias})

    if not anios:
        return None
    return {"plan_estudio": anios, "plan_fuente": url_plan}


print("\n📚 Buscando planes de estudio por carrera (solo grados de 3 años o más)...")
for carrera in utn_data["carreras"]:
    nombre = carrera["nombre_carrera"]
    # El alcance es grado/pregrado de 3 años o más.
    if (duracion_a_anios(carrera.get("duracion")) or 0) < 3:
        print(f"  ⏭️ {nombre}: dura menos de 3 años, sin plan en catálogo.")
        continue
    # Ya lo descubrimos: no lo volvemos a bajar.
    if carrera.get("plan_estudio"):
        continue
    url_plan = None
    # 1) Buscamos el link "Plan de estudio" en el sitio oficial de la carrera.
    try:
        req = requests.get(carrera["link_oficial"], timeout=15)
        req.raise_for_status()
        sopa = BeautifulSoup(req.text, "html.parser")
        for enlace in sopa.find_all("a", href=True):
            etiqueta = " ".join(enlace.get_text(" ", strip=True).split()).lower()
            href = enlace["href"]
            if "plan de estudio" in etiqueta or ("plan" in etiqueta and "estudio" in etiqueta):
                url_plan = href if href.startswith("http") else "https://frm.utn.edu.ar" + href
                break
    except Exception:
        pass
    # 2) Patrón de espalda con las URLs ya verificadas.
    if not url_plan and nombre in PLANES_CONOCIDOS:
        url_plan = PLANES_CONOCIDOS[nombre]

    if not url_plan:
        print(f"  ⏭️ {nombre}: sin página de plan detectable.")
        continue

    plan = extraer_plan(url_plan)
    if plan:
        carrera.update(plan)
        total = sum(len(a["materias"]) for a in plan["plan_estudio"])
        print(f"  ✅ {nombre}: {len(plan['plan_estudio'])} años, {total} materias.")
    else:
        print(f"  ⚠️ {nombre}: la página {url_plan} no expuso años parseables.")

guardar_json(base_utn, "utn.json")
print("\n🎉 UTN terminada (con planes de estudio). Todo guardado en 'utn.json'.")