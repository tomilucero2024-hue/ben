"""Completa el plan de estudio de las instituciones chicas que quedaron.

Cada IES publica el plan distinto: listas por año (9-005), un PDF de
resolución (9-018) o un archivo en Google Drive (9-003). Acá se resuelve con
un manejador por institución, validando que el resultado sea un plan real.

No inventa: lo que no se puede leer queda pendiente y se lista al final.

Uso:
    python3 scrapers/planes_sitios.py [--dry] [archivo.json ...]
"""

import json
import re
import sys
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from pdf_utils import _plan_creible, _texto_pdf, enlaces_pdf, plan_desde_resolucion
from scraper_utils import DIR_DATOS, guardar_json

H = {"User-Agent": "Mozilla/5.0"}
NAV = re.compile(r"NUESTRO|CARRERAS|Datos institucionales|Autoridades|Historia|"
                 r"Ubicaci|El Instituto|POST[ÍI]TULOS|GRUPO SIO|DESTACADOS|"
                 r"NORMATIVA|Contacto|Buscar|MENDOZA", re.I)
NOMBRES_ANIO = ["Primer año", "Segundo año", "Tercer año", "Cuarto año", "Quinto año"]


def _limpio(texto):
    return re.sub(r"\s+", " ", texto.replace("\xa0", " ")).strip()


# --- Manejadores por institución -------------------------------------------

def plan_listas_por_anio(sopa, url, nombre=""):
    """9-005: un <ul> de materias por año (ítems cortos, sin navegación)."""
    anios = []
    for ul in sopa.find_all(["ul", "ol"]):
        items = [_limpio(li.get_text(" ", strip=True))
                 for li in ul.find_all("li", recursive=False)]
        items = [i for i in items if i]
        if not 4 <= len(items) <= 25:
            continue
        if any(NAV.search(i) for i in items[:2]):
            continue
        if any(re.search(r"jefatura|coordinaci|docentes|portal|convocatoria|"
                         r"suplencias|horarios?|cursado|secretar|preceptor|"
                         r"equivalen|requisitos|carrera:|resoluci|programa:|"
                         r"t[íi]tulo que|familia profesional|"
                         r"total de horas|descargar", i, re.I) for i in items):
            continue
        if any(len(i) > 75 or len(i.split()) > 11 for i in items):
            continue
        anios.append(items)
    if len(anios) < 2:
        return None
    return [{"anio": NOMBRES_ANIO[i] if i < len(NOMBRES_ANIO) else f"Año {i + 1}",
             "materias": materias}
            for i, materias in enumerate(anios)]


def plan_pdf_o_drive(sopa, url, nombre=""):
    """9-003 / 9-018: el plan vive en un PDF enlazado o en Google Drive."""
    for texto, href in enlaces_pdf(sopa):
        if not re.search(r"plan|pei|anexo|dise|curric", texto + href, re.I):
            continue
        try:
            contenido = requests.get(urljoin(url, href), headers=H, timeout=60).content
        except Exception:
            continue
        plan = plan_desde_resolucion(contenido)
        if plan and _valido(plan):
            return plan
    for a in sopa.find_all("a", href=True):
        m = re.search(r"drive\.google\.com/file/d/([\w-]+)", a["href"])
        if not m:
            continue
        enlace = f"https://drive.google.com/uc?export=download&id={m.group(1)}"
        try:
            contenido = requests.get(enlace, headers=H, timeout=60).content
        except Exception:
            continue
        plan = plan_desde_resolucion(contenido)
        if plan and _valido(plan):
            return plan
    return None


_RX_ANIO_MOD = re.compile(r"^\s*([1-6])\s*[°º]?\s*A[ÑN]O\s*$", re.I)
_RX_MODULO = re.compile(r"^\s*M[ÓO]DULO\s+(\d+)\s*:?\s*(.*)$", re.I)


def _plan_modulos(texto):
    """9-018: diseño modular; cada año agrupa módulos 'Módulo N: Nombre'."""
    lineas = texto.splitlines()
    inicio = 0
    for i, linea in enumerate(lineas):
        if re.search(r"descriptores de las unidades", linea, re.I):
            inicio = i + 1
            break
    plan = []
    for linea in lineas[inicio:]:
        s = linea.strip()
        if not s:
            continue
        if re.search(r"correlatividad|requisitos?\s+para|acreditaci[óo]n", s, re.I):
            break
        enc = _RX_ANIO_MOD.match(s)
        if enc:
            plan.append({"anio": enc.group(1) + "º año", "materias": []})
            continue
        m = _RX_MODULO.match(s)
        if m and plan:
            titulo = f"Módulo {m.group(1)}: {m.group(2).strip(' .,;:-')}".strip()
            plan[-1]["materias"].append(titulo[:90])
    return [tramo for tramo in plan if tramo["materias"]] or None


def plan_pdf_modulos(sopa, url, nombre=""):
    """9-018: busca el ANEXO en PDF y lo lee como diseño modular."""
    for texto, href in enlaces_pdf(sopa):
        if not re.search(r"petr[óo]leo|gas|anexo|plan|modular", texto + href, re.I):
            continue
        try:
            contenido = requests.get(urljoin(url, href), headers=H, timeout=60).content
        except Exception:
            continue
        plan = _plan_modulos(_texto_pdf(contenido))
        if plan:
            return plan
    return None


def plan_tabla_materias(sopa):
    """9-002: tabla con filas de año y una materia por fila."""
    plan = []
    for tabla in sopa.find_all("table"):
        for tr in tabla.find_all("tr"):
            celdas = [_limpio(c.get_text(" ", strip=True))
                      for c in tr.find_all(["td", "th"])]
            if not celdas or not celdas[0]:
                continue
            m = re.match(r"^(primer|segundo|tercer|cuarto|quinto)\s*a[ñn]o",
                         celdas[0], re.I)
            if m:
                plan.append({"anio": celdas[0], "materias": []})
                continue
            if plan and not re.fullmatch(
                    r"(anual|[12]\s*(er|o|º|°)?\s*cuat\.?|•|\s*)", celdas[0], re.I):
                plan[-1]["materias"].append(celdas[0])
    return [tramo for tramo in plan if tramo["materias"]] or None


def plan_tabla_con_enlace(sopa, url, nombre=""):
    """9-002: la tabla puede estar en la ficha o en una página 'plan-de-estudio'.
    Solo Primaria publica esa página; el resto sigue pendiente."""
    plan = plan_tabla_materias(sopa)
    if plan:
        return plan
    if "primaria" not in nombre.lower():
        return None
    for a in sopa.find_all("a", href=True):
        if ("plan-de-estudio" in a["href"]
                and re.match(r"plan de estudi", a.get_text(" ", strip=True), re.I)):
            try:
                hija = BeautifulSoup(requests.get(urljoin(url, a["href"]), headers=H,
                                                  timeout=25).text, "html.parser")
            except Exception:
                continue
            plan = plan_tabla_materias(hija)
            if plan:
                return plan
    return None


def plan_enlace(sopa, url, nombre=""):
    """Sigue el enlace "Plan de estudios"/"Diseño curricular" y lo interpreta."""
    for a in sopa.find_all("a", href=True):
        if re.search(r"plan de estudi|dise[ñn]o curricular",
                     a.get_text(" ", strip=True), re.I):
            try:
                contenido = requests.get(urljoin(url, a["href"]), headers=H,
                                         timeout=60).content
            except Exception:
                continue
            plan = plan_desde_resolucion(contenido)
            if plan and _valido(plan):
                return plan
    return None


def _anio_del_enlace(blob):
    """Año estimado del documento: 20xx o el sufijo 'NN/aa' de la resolución."""
    anios = [int(y) for y in re.findall(r"(20\d{2})", blob)]
    for d in re.findall(r"/(\d{2})\b", blob):
        anios.append(2000 + int(d) if int(d) < 50 else 1900 + int(d))
    return max(anios or [0])


def plan_enlace_amplio(sopa, url, nombre=""):
    """Busca PDF/Drive con pinta de plan (incluye resoluciones) y elige la más nueva."""
    candidatos = []
    for a in sopa.find_all("a", href=True):
        href = a["href"]
        texto = a.get_text(" ", strip=True)
        blob = href + " " + texto
        if not re.search(r"plan|dise[ñn]o|curric|anexo|resol", blob, re.I):
            continue
        if re.search(r"correlativ|rai\b|calendario|contingencia", blob, re.I):
            continue
        try:
            if href.lower().endswith(".pdf"):
                contenido = requests.get(urljoin(url, href), headers=H, timeout=60).content
            elif "drive.google.com/file/d/" in href:
                fid = re.search(r"/d/([\w-]+)", href).group(1)
                contenido = requests.get(
                    f"https://drive.google.com/uc?export=download&id={fid}",
                    headers=H, timeout=60).content
            else:
                continue
        except Exception:
            continue
        plan = plan_desde_resolucion(contenido)
        if plan and _valido(plan):
            candidatos.append((_anio_del_enlace(blob), plan))
    if not candidatos:
        return None
    candidatos.sort(key=lambda x: -x[0])
    return candidatos[0][1]


MANEJADORES = {
    "ies9023.json": plan_enlace_amplio,
    "ies9024.json": plan_enlace_amplio,
    "ies9026.json": plan_enlace_amplio,
    "ies9005.json": plan_listas_por_anio,
    "ies9003.json": plan_pdf_o_drive,
    "ies9018.json": plan_pdf_modulos,
    "ies_godoycruz.json": plan_tabla_con_enlace,
    "ies9014.json": plan_pdf_o_drive,
    "ies9030.json": plan_enlace,
    "ies9012.json": plan_listas_por_anio,
}


def _valido(plan):
    """Plan con forma de plan: pocos años, unidades y nombres acotados."""
    if not plan or len(plan) > 6:
        return False
    total = sum(len(a["materias"]) for a in plan)
    if len(plan) == 1 and total > 20:      # un año con todo amontonado: mal parseo
        return False
    return (total <= 60 and all(len(a["materias"]) <= 40 for a in plan)
            and all(len(m) <= 95 for a in plan for m in a["materias"]))


def procesar(json_nombre, dry=False):
    manejador = MANEJADORES.get(json_nombre)
    if not manejador:
        return None
    datos = json.load(open(DIR_DATOS / json_nombre, encoding="utf-8"))
    asignados, pendientes, errores = [], [], []
    for inst in datos.get("instituciones", []):
        for c in inst.get("carreras", []):
            if c.get("plan_estudio"):
                continue
            url = c.get("link_oficial")
            nombre = c.get("nombre_carrera", "")
            if not url:
                pendientes.append((nombre, "(sin link)"))
                continue
            try:
                sopa = BeautifulSoup(requests.get(url, headers=H, timeout=25).text,
                                     "html.parser")
                plan = manejador(sopa, url, nombre)
                if plan and "profesorado" in nombre.lower() and len(plan) < 4:
                    plan = None            # profesorado incompleto: mejor pendiente
                if plan and _valido(plan):
                    c["plan_estudio"] = plan
                    c["plan_fuente"] = url
                    asignados.append((nombre, len(plan),
                                      sum(len(a["materias"]) for a in plan)))
                else:
                    pendientes.append((nombre, url))
            except Exception as e:
                errores.append((nombre, url, type(e).__name__))
    if asignados and not dry:
        guardar_json(datos, json_nombre)
    return asignados, pendientes, errores


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    for nombre in (args or list(MANEJADORES)):
        res = procesar(nombre, dry=dry)
        if res is None:
            continue
        asignados, pendientes, errores = res
        print(f"\n### {nombre} — {len(asignados)} asignadas" + ("  (DRY RUN)" if dry else ""))
        for n, y, m in asignados:
            print(f"   OK  {str(n)[:52]:54} {y}a/{m}m")
        for n, u in pendientes:
            print(f"   --  {str(n)[:52]:54} {u}")
        for n, u, e in errores:
            print(f"   !!  {str(n)[:52]:54} {e}")


if __name__ == "__main__":
    main()
