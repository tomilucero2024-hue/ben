"""Extracción de planes de estudio desde los PDFs institucionales.

Varios IES publican el plan como un flyer diseñado (dos columnas: primer y
segundo año a la izquierda, tercero y cuarto a la derecha), con cada materia en
una viñeta. `pdftotext` en modo texto plano lo devuelve desordenado, así que acá
se leen las coordenadas de cada palabra con `pdftotext -bbox` y se reconstruye
cada columna por separado.

Si el PDF no tiene texto (viene escaneado), no hay nada que extraer y devuelve
None: preferimos dejar la carrera sin plan antes que inventarlo.
"""

import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import requests

_NS = "{http://www.w3.org/1999/xhtml}"
_RE_ANIO = re.compile(r"^(primer|segundo|tercer|cuarto|quinto|sexto)\s+a[ñn]o\b", re.I)
_MAPA_ANIO = {"primer": "1", "segundo": "2", "tercer": "3",
              "cuarto": "4", "quinto": "5", "sexto": "6"}
# Pie de página y logos que el flyer imprime al final de cada columna.
_RE_PIE = re.compile(r"ISFD|Powered by|RIVADAVIA|9-0\d\d|MENDOZA|Escuela Suite", re.I)


def _ancho_y_palabras(ruta_pdf):
    """Ancho de página y palabras con (xMin, yMin, xMax, texto)."""
    with tempfile.TemporaryDirectory() as tmp:
        salida = os.path.join(tmp, "bbox.html")
        subprocess.run(["pdftotext", "-bbox", ruta_pdf, salida],
                       check=True, timeout=120,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        root = ET.parse(salida).getroot()
    paginas = list(root.iter(_NS + "page"))
    ancho = float(paginas[0].get("width")) if paginas else 595.0
    palabras = [
        (float(w.get("xMin")), float(w.get("yMin")), float(w.get("xMax")), w.text or "")
        for w in root.iter(_NS + "word")
    ]
    return ancho, palabras


def _lineas(palabras, tolerancia=4):
    """Agrupa palabras en renglones por cercanía vertical."""
    palabras = sorted(palabras, key=lambda w: (w[1], w[0]))
    lineas = []
    for palabra in palabras:
        if lineas and abs(palabra[1] - lineas[-1][0][1]) < tolerancia:
            lineas[-1].append(palabra)
        else:
            lineas.append([palabra])
    return lineas


def plan_desde_pdf(datos_pdf):
    """Interpreta el flyer a dos columnas y devuelve el plan, o None."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(datos_pdf)
        ruta = tmp.name
    try:
        ancho, palabras = _ancho_y_palabras(ruta)
    except Exception:
        return None
    finally:
        os.unlink(ruta)
    if not palabras:
        return None

    mitad = ancho * 0.5
    columnas = {"L": [], "R": []}
    for linea in _lineas(palabras):
        for clave, costado in (("L", [w for w in linea if w[2] <= mitad]),
                               ("R", [w for w in linea if w[2] > mitad])):
            if costado:
                costado.sort(key=lambda w: w[0])
                columnas[clave].append((costado[0][1], " ".join(w[3] for w in costado)))

    plan = []
    for clave in ("L", "R"):
        actual = None
        for _, texto in sorted(columnas[clave]):
            coincidencia = _RE_ANIO.match(texto)
            if coincidencia:
                actual = {"anio": _MAPA_ANIO[coincidencia.group(1).lower()] + "º año",
                          "materias": []}
                plan.append(actual)
                continue
            if _RE_PIE.search(texto):
                continue
            if actual is None:
                continue
            if texto.lstrip().startswith("•"):
                materia = texto.lstrip("• ").strip()
                if materia:
                    actual["materias"].append(materia)
            elif actual["materias"]:
                actual["materias"][-1] += " " + texto
    return [tramo for tramo in plan if tramo["materias"]] or None


_RX_ANIO_CAPS = re.compile(
    r"^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO)\s+A[ÑN]O$", re.I)
_RX_ANIO_NUM = re.compile(r"^([1-6])\s*[°º]?\s*A[ÑN]O$", re.I)
_MAPA_ANIO_LARGO = {"primer": "1", "segundo": "2", "tercer": "3",
                    "cuarto": "4", "quinto": "5", "sexto": "6"}


def _es_titulo_unidad(texto):
    """Heurística: la línea parece el título de un espacio curricular, no prosa."""
    if not 3 <= len(texto) <= 85:
        return False
    if texto.endswith("."):
        return False
    if re.match(r"^[a-záéíóúñ]", texto):
        return False
    if len(texto.split()) > 12:
        return False
    if re.search(r"\b(Total|Cuatrimestre|P[áa]gina|HC|HCT|Formato|C[óo]d|"
                 r"Descriptores|Unidad Curricular)\b", texto):
        return False
    if re.search(r"r[ée]gimen|correlatividad|perfiles?", texto, re.I):
        return False
    return True


def plan_desde_descriptores(texto):
    """Plan desde la sección "Descriptores por espacio curricular".

    Lista cada unidad como `N. Nombre`, agrupada por encabezados de año
    (PRIMER AÑO / 1° AÑO), en mayúsculas o capitalizada."""
    lineas = texto.splitlines()
    ini = 0
    for i, linea in enumerate(lineas):
        if (re.match(r"^\s*\d*\.?\s*descriptores\b", linea, re.I)
                or re.search(r"descriptores?\s+por\s+espacio", linea, re.I)):
            ini = i + 1
            break
    plan, actual, vistos_anios, ultimo = [], None, set(), 0
    for linea in lineas[ini:]:
        s = linea.strip()
        enc = _RX_ANIO_CAPS.match(s) or _RX_ANIO_NUM.match(s)
        if enc:
            clave = enc.group(1).lower()
            num = _MAPA_ANIO_LARGO.get(clave, clave)
            if num in vistos_anios:      # arranca otra tabla/sección: termina
                break
            vistos_anios.add(num)
            actual = {"anio": num + "º año", "materias": []}
            plan.append(actual)
            ultimo = 0
            continue
        u = re.match(r"^(\d{1,2})\.\s+(.+?)\s*$", s)
        if u and actual is not None and _es_titulo_unidad(u.group(2)):
            codigo = int(u.group(1))
            if codigo <= ultimo:         # la numeración reinició: otra sección
                break
            ultimo = codigo
            actual["materias"].append(re.sub(r"\s+", " ", u.group(2)).strip(" .,;:-"))
    for tramo in plan:
        vistos, unicas = set(), []
        for materia in tramo["materias"]:
            clave = materia.lower()
            if clave not in vistos:
                vistos.add(clave)
                unicas.append(materia)
        tramo["materias"] = unicas
    return [tramo for tramo in plan if tramo["materias"]] or None


def _palabras_por_pagina(datos_pdf):
    """[(pagina, xMin, yMin, texto)] del PDF, vía pdftotext -bbox."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(datos_pdf)
        ruta = tmp.name
    try:
        with tempfile.TemporaryDirectory() as carpeta:
            salida = os.path.join(carpeta, "bbox.html")
            subprocess.run(["pdftotext", "-bbox", ruta, salida], check=True,
                           timeout=120, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
            root = ET.parse(salida).getroot()
        palabras = []
        for pi, pagina in enumerate(root.iter(_NS + "page")):
            for w in pagina.iter(_NS + "word"):
                palabras.append((pi, float(w.get("xMin")), float(w.get("yMin")),
                                 w.text or ""))
        return palabras
    except Exception:
        return []
    finally:
        os.unlink(ruta)


def plan_desde_pdf_tabla(datos_pdf):
    """Plan desde la tabla "Distribución de espacios curriculares por año".

    Las resoluciones DGE traen dos cuatrimestres en paralelo; las denominaciones
    se parten en varias líneas. Se leen las coordenadas y se asignan los
    fragmentos al código de unidad más cercano en vertical."""
    palabras = _palabras_por_pagina(datos_pdf)
    if not palabras:
        return None
    filas = {}
    for p, x, y, t in palabras:
        filas.setdefault(p * 100000 + round(y / 4), []).append((x, t))
    claves = sorted(filas)

    # Cabeceras válidas: "Cód. | Denominación" (con columna de código) o
    # "Espacio curricular | Formato" (el número va dentro del nombre).
    header = []
    for k in claves:
        toks = [t for _, t in filas[k]]
        if toks.count("Denominación") >= 2 and toks.count("Cód.") >= 2:
            cod = sorted(x for x, t in filas[k] if t == "Cód.")
            den = sorted(x for x, t in filas[k] if t == "Denominación")
        elif toks.count("Espacio") >= 2:
            cod = []
            den = sorted(x for x, t in filas[k] if t == "Espacio")
        else:
            continue
        form = sorted(x for x, t in filas[k] if t == "Formato")
        if len(form) < 2:
            for k2 in claves[max(0, claves.index(k) - 4):claves.index(k)]:
                form = sorted(x for x, t in filas[k2] if t == "Formato")
                if len(form) >= 2:
                    break
        if len(den) >= 2 and len(form) >= 2:
            header.append((k, cod, den, form))

    plan = []
    for hi, (k, cod, den, form) in enumerate(header):
        s = claves.index(k) + 1
        e = claves.index(header[hi + 1][0]) if hi + 1 < len(header) else len(claves)
        rango_nombre = [(den[0] - 6, form[0] - 4), (den[1] - 6, form[1] - 4)]
        if cod:
            umbral = cod[1] - 8
            rango_codigo = [(cod[0] - 8, den[0] - 6), (cod[1] - 8, den[1] - 6)]
        else:
            umbral = (form[0] + den[1]) / 2
            rango_codigo = None
        codigos = [[], []]
        fragmentos = [[], []]
        for kk in claves[s:e]:
            tk = [t for _, t in filas[kk]]
            if "Total" in tk and any("hora" in t for t in tk):
                break
            if tk.count("Denominación") >= 2 or tk.count("Espacio") >= 2:
                break
            for x, t in filas[kk]:
                h = 0 if x < umbral else 1
                if rango_codigo:
                    if (rango_codigo[h][0] <= x < rango_codigo[h][1]
                            and re.fullmatch(r"\d{1,2}", t)):
                        codigos[h].append((kk, int(t)))
                    elif (rango_nombre[h][0] <= x < rango_nombre[h][1]
                            and not re.search(r"C[óo]d|Denominaci|Unidad|Curricular|"
                                              r"Formato|Cuatrimestre|Total|r[ée]gimen|"
                                              r"correlatividad", t, re.I)):
                        fragmentos[h].append((kk, x, t))
                elif rango_nombre[h][0] <= x < rango_nombre[h][1]:
                    if re.fullmatch(r"\d{1,2}\.?", t):
                        codigos[h].append((kk, int(t.rstrip("."))))
                    elif not re.search(r"Espacio|Curricular|Formato|Cuatrimestre|"
                                       r"Total|Semanales|Anuales", t, re.I):
                        fragmentos[h].append((kk, x, t))

        def armar(h):
            unidades = {}
            for kk, x, t in fragmentos[h]:
                if not codigos[h]:
                    continue
                cercano = min(codigos[h], key=lambda c: abs(c[0] - kk))[1]
                unidades.setdefault(cercano, []).append((kk, x, t))
            return {k2: " ".join(t for _, _, t in sorted(v))
                    for k2, v in unidades.items()}

        izq, der = armar(0), armar(1)
        vistos, materias = set(), []
        for k2 in sorted(set(izq) | set(der)):
            valor = izq.get(k2) or der.get(k2)
            clave = re.sub(r"\W+", "", valor.lower())
            if valor and len(clave) > 2 and clave not in vistos:
                vistos.add(clave)
                materias.append(re.sub(r"\s+", " ", valor).strip())
        if materias:
            plan.append({"anio": f"{len(plan) + 1}º año", "materias": materias})
    return plan or None


_RX_DENOMINACION = re.compile(r"Denominaci[óo]n\s*:?\s*(\d+)\s*[.\-\u2013]\s*(.+)", re.I)
_RX_UBICACION = re.compile(
    r"Ubicaci[óo]n en (?:la organizaci[óo]n|el mapa) curricular\s*:?\s*"
    r"(primer|segundo|tercer|cuarto|quinto|sexto|[1-6])\s*[°º]?\s*A[ñn]o", re.I)


def plan_desde_denominaciones(texto):
    """Plan desde el formato "Denominación: N - Nombre" + "Ubicación ... X° Año".

    Lo usan las resoluciones que listan cada espacio con su año de cursado."""
    unidades = []
    actual = None
    for linea in texto.splitlines():
        s = linea.strip()
        m = _RX_DENOMINACION.search(s)
        if m:
            actual = {"num": int(m.group(1)), "titulo": m.group(2).strip(),
                      "anio": None}
            unidades.append(actual)
            continue
        mu = _RX_UBICACION.search(s)
        if mu and actual is not None:
            clave = mu.group(1).lower()
            actual["anio"] = int(_MAPA_ANIO_LARGO.get(clave, clave))
            continue
        if (actual is not None and actual["anio"] is None and s
                and ":" not in s and not s.endswith(".") and len(s) <= 70
                and re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", s)):
            actual["titulo"] += " " + s
    if not unidades:
        return None
    años = {}
    for u in unidades:
        if u["anio"] is None:
            continue
        años.setdefault(u["anio"], [])
        titulo = re.sub(r"\s+", " ", u["titulo"]).strip(" .,;:-")
        if len(titulo) > 85:                      # se coló la descripción tras el punto
            titulo = re.split(r"\.\s", titulo)[0].strip(" .,;:-")
        if titulo and titulo.lower() not in {t.lower() for t in años[u["anio"]]}:
            años[u["anio"]].append(titulo)
    return [{"anio": f"{y}º año", "materias": materias}
            for y, materias in sorted(años.items()) if materias] or None


_RX_ANIO_PALABRA = re.compile(
    r"^\s*(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO)\s+A[ÑN]O\s*$", re.I)
_RX_UNIDAD_NUM = re.compile(r"^\s*(\d{1,2})\.\s+([A-Za-zÁÉÍÓÚÑ].{2,90})$")


_RX_LOCALIZACION = re.compile(
    r"(?:Localizaci[óo]n en el dise[ñn]o|Ubicaci[óo]n en (?:la organizaci[óo]n|el mapa))"
    r" curricular\s*:?\s*"
    r"(primer|segundo|tercer|cuarto|quinto|sexto|[1-6])\s*[°º]?\s*A[ñn]o", re.I)


def plan_desde_diseno_curricular(texto):
    """Plan del "Diseño Curricular" del Profesorado de Arte: espacios numerados
    `N. Nombre` seguidos de "Localización en el diseño curricular: <año>"."""
    lineas = texto.splitlines()
    por_anio = {}
    for i, linea in enumerate(lineas):
        u = _RX_UNIDAD_NUM.match(linea.strip())
        if not u:
            continue
        nombre = u.group(2).strip(" .,;:-")
        if not _es_titulo_unidad(nombre):
            continue
        anio = None
        for j in range(i + 1, min(i + 7, len(lineas))):
            ml = _RX_LOCALIZACION.search(lineas[j])
            if ml:
                clave = ml.group(1).lower()
                anio = int(_MAPA_ANIO_LARGO.get(clave, clave))
                break
        if anio is None:          # no es una unidad del plan (p. ej. correlativas)
            continue
        por_anio.setdefault(anio, [])
        if nombre.lower() not in {m.lower() for m in por_anio[anio]}:
            por_anio[anio].append(nombre)
    return [{"anio": f"{y}º año", "materias": materias}
            for y, materias in sorted(por_anio.items()) if materias] or None


def _plan_creible(plan):
    """Descarta documentos que no son un plan (resoluciones con cientos de líneas)."""
    if not plan or len(plan) > 6:
        return False
    total = sum(len(a["materias"]) for a in plan)
    if total > 60 or any(len(a["materias"]) > 40 for a in plan):
        return False
    # Un espacio curricular es un nombre corto; si hay párrafos, se coló prosa.
    nombres = [m for a in plan for m in a["materias"]]
    return all(len(m) <= 90 and len(m.split()) <= 12 for m in nombres)


def plan_desde_resolucion(datos_pdf):
    """Prueba descriptores y tabla; devuelve el plan más completo y creíble."""
    candidatos = []
    for texto in (_texto_pdf(datos_pdf), _texto_pdf_raw(datos_pdf)):
        for fn in (plan_desde_descriptores, plan_desde_denominaciones,
                   plan_desde_diseno_curricular):
            plan = fn(texto)
            if plan and _plan_creible(plan):
                candidatos.append(plan)
    plan = plan_desde_pdf_tabla(datos_pdf)
    if plan and _plan_creible(plan):
        candidatos.append(plan)
    if not candidatos:
        return None
    return max(candidatos, key=lambda p: sum(len(a["materias"]) for a in p))


def plan_desde_url_pdf(url):
    """Descarga un PDF y devuelve su plan, o None si falla."""
    try:
        respuesta = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=60)
        respuesta.raise_for_status()
        return plan_desde_pdf(respuesta.content)
    except Exception:
        return None


_RX_ANIO = re.compile(
    r"^(primer|segundo|tercer|cuarto|quinto|sexto|1er|2do|3ro|4to|1ro|"
    r"1°|2°|3°|4°|1º|2º|3º|4º)\s*(a[ñn]o|AÑO)\b",
    re.I,
)
_MAPA_NUM = {"primer": "1", "segundo": "2", "tercer": "3", "cuarto": "4",
             "quinto": "5", "sexto": "6", "1er": "1", "1ro": "1", "1°": "1",
             "1º": "1", "2do": "2", "2°": "2", "2º": "2", "3ro": "3",
             "3°": "3", "3º": "3", "4to": "4", "4°": "4", "4º": "4"}


def _texto_pdf_raw(ruta_o_bytes):
    """Texto sin `-layout` (mantiene unidas las palabras con kerning raro)."""
    if isinstance(ruta_o_bytes, (bytes, bytearray)):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(ruta_o_bytes)
            ruta = tmp.name
        borrar = True
    else:
        ruta, borrar = ruta_o_bytes, False
    try:
        salida = subprocess.run(["pdftotext", "-raw", ruta, "-"],
                                capture_output=True, text=True, timeout=120)
        return salida.stdout or ""
    except Exception:
        return ""
    finally:
        if borrar:
            os.unlink(ruta)


def _texto_pdf(ruta_o_bytes):
    """Devuelve el texto plano (layout) de un PDF, o '' si no tiene texto."""
    if isinstance(ruta_o_bytes, (bytes, bytearray)):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(ruta_o_bytes)
            ruta = tmp.name
        borrar = True
    else:
        ruta, borrar = ruta_o_bytes, False
    try:
        salida = subprocess.run(["pdftotext", "-layout", ruta, "-"],
                                capture_output=True, text=True, timeout=120)
        return salida.stdout or ""
    except Exception:
        return ""
    finally:
        if borrar:
            os.unlink(ruta)


def _limpiar_materia(texto):
    texto = re.sub(r"\s+", " ", texto).strip()
    texto = re.sub(r"^\d+\s*[\.\)\-]\s*", "", texto)
    texto = re.sub(r"\s*\(\s*\d+[^)]*\)\s*$", "", texto).strip()
    return texto.strip(" \t.,;:-–—·•").strip()


def plan_desde_texto(texto):
    """Interpreta un plan de estudios en texto plano.

    Formato típico: encabezados 'Primer año'/'1er AÑO' seguidos de las
    materias (una por línea, a veces numeradas o separadas por comas)."""
    plan = []
    anio = None
    for linea in texto.splitlines():
        linea = re.sub(r"\s+", " ", linea).strip()
        if not linea:
            continue
        coincidencia = _RX_ANIO.match(linea)
        if coincidencia:
            clave = coincidencia.group(1).lower()
            plan.append({"anio": _MAPA_NUM.get(clave, clave) + "º año", "materias": []})
            anio = plan[-1]
            continue
        if anio is None:
            continue
        if re.match(r"^plan de estudios", linea, re.I):
            continue
        if re.search(r"p[áa]gina\s*\d|^\d{1,3}$", linea, re.I):
            continue
        if re.search(r"cuatrimestre", linea, re.I):
            resto = linea.split(":", 1)[1] if ":" in linea else ""
            for parte in resto.split(","):
                materia = _limpiar_materia(parte)
                if 2 < len(materia) < 95:
                    anio["materias"].append(materia)
            continue
        if linea.isupper() and len(linea) > 30:
            continue
        materia = _limpiar_materia(linea)
        if 2 < len(materia) < 95:
            anio["materias"].append(materia)

    for tramo in plan:
        vistos, unicas = set(), []
        for materia in tramo["materias"]:
            clave = materia.lower()
            if clave not in vistos:
                vistos.add(clave)
                unicas.append(materia)
        tramo["materias"] = unicas
    return [tramo for tramo in plan if tramo["materias"]] or None


def plan_desde_url_pdf_generico(url):
    """Descarga un PDF y devuelve su plan en texto, o None si no tiene texto."""
    try:
        respuesta = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=60)
        respuesta.raise_for_status()
        return plan_desde_texto(_texto_pdf(respuesta.content))
    except Exception:
        return None


def enlaces_pdf(sopa):
    """Lista [(texto, href)] de los PDFs enlazados en una página."""
    enlaces = []
    for a in sopa.find_all("a", href=True):
        href = a["href"]
        if href.lower().split("?")[0].endswith(".pdf"):
            enlaces.append((a.get_text(" ", strip=True), href))
    return enlaces


def primer_pdf_de_plan(sopa):
    """El enlace al PDF del plan: prioriza los que dicen 'plan' en el texto."""
    enlaces = enlaces_pdf(sopa)
    for texto, href in enlaces:
        if re.search(r"plan", texto, re.I):
            return href
    return enlaces[0][1] if enlaces else None
