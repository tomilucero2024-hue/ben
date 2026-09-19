import re
import subprocess
import sys


def filas_bbox(pdf_path):
    xml = subprocess.run(
        ["pdftotext", "-bbox", pdf_path, "-"],
        capture_output=True, text=True,
    ).stdout
    filas = []
    pagina = 0
    for m in re.finditer(r'(?:<page )|<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', xml):
        if m.group(0).startswith('<page'):
            pagina += 1
            continue
        xmin, ymin, xmax, ymax, txt = (float(m.group(1)), float(m.group(2)),
                                       float(m.group(3)), float(m.group(4)), m.group(5))
        filas.append((pagina, ymin, xmin, xmax, txt))
    return filas


def agrupar_lineas(filas, tol=6.0):
    filas.sort(key=lambda f: (f[0], f[1], f[2]))
    lineas = []
    for p, y, x, xe, t in filas:
        if lineas and lineas[-1][0] == p and abs(lineas[-1][1] - y) <= tol:
            lineas[-1][2].append((x, xe, t))
        else:
            lineas.append([p, y, [(x, xe, t)]])
    return lineas


DEFEOS = {
    "So�tware": "Software", "Con�lictos": "Conflictos", "�luido": "fluido",
    "Artiﬁcial": "Artificial", "artiﬁcial": "artificial", "Cientíﬁca": "Científica",
    "ﬁ": "fi", "ﬂ": "fl",
}
PAL_JUNTA = {
    "PAlgoritmos": "Algoritmos",
    "PAlgoritmos,": "Algoritmos,",
    "PAlgoritmos,": "Algoritmos,",
    "So\uFFFDware": "Software",
}

# Rango "normal" de caracteres para detectar glifos corruptos (fuente Adobe rota)
TEXT_ANOMALO = re.compile(r'[^\x20-\x7EÁÉÍÓÚÜÑáéíóúüñ°º\-–—\'´/.,:;()¿¡+]')

REGIMENES = {"Semestral", "Anual", "Cuatrimestral", "Bimestral",
             "Presencial", "A", "Distancia", "Virtual"}


def es_reg(t):
    return t in REGIMENES or re.match(r'^[\d,\-–—\s:]+$', t)


def limpiar(txt):
    for k, v in DEFEOS.items():
        txt = txt.replace(k, v)
    txt = re.sub(r'�', 'i', txt)
    return txt


def es_anomalo(txt):
    return bool(TEXT_ANOMALO.search(txt))


MARCADOR_RE = re.compile(r'^(AÑO|\d{1,2}°)$')

# Nombres con glifos corruptos (ToUnicode roto). Verificado visualmente via OCR
# de los renders 600dpi en /tmp/opencode/uch_ocr2/ (sep 2026).
CORRUPTS = {
    "Administracion_empresas": {"18": "Planificación Estratégica"},
    "Comercio_internacional": {
        "16": "Clasificación y Valoración Aduanera",
        "31": "Inglés IV",
    },
    "Lic_Turismo": {
        "33": "Planificación I",
        "43": "Planificación II",
    },
    "Relaciones_humanas": {"19": "Antropología Filosófica"},
    "Relaciones_publicas": {"19": "Antropología Filosófica"},
}


def aplicar_corruptos(pdf_path, tramos):
    base = pdf_path.split("/")[-1].replace(".pdf", "")
    fix = CORRUPTS.get(base)
    if not fix:
        return tramos
    corregido = []
    n = 1
    for tramo in tramos:
        nuevo = []
        for m in tramo:
            r = fix.get(str(n))
            if r:
                m = r
            nuevo.append(m)
            n += 1
        corregido.append(nuevo)
    return corregido


def parsear_nuevo(pdf_path):
    txt = subprocess.run(["pdftotext", "-layout", pdf_path, "-"],
                         capture_output=True, text=True).stdout
    tramos = []
    anyo = 1
    materias = []
    for linea in txt.splitlines():
        m = re.match(r'^\s*(\d{1,2})°\s*A\s*Ñ\s*O\s*$', linea)
        if m:
            n = int(m.group(1))
            if n >= 2:
                if materias:
                    tramos.append(materias)
                    materias = []
                anyo = n
            continue
        mm = re.match(r'^\s*(\d{1,2})\s+(\S.*?)\s*$', linea)
        if mm:
            cod = mm.group(1)
            toks = mm.group(2).split()
            if toks[0] in ("a.", "b."):
                continue
            nombre = []
            for t in toks:
                if es_reg(t):
                    break
                nombre.append(t)
            n = limpiar(" ".join(nombre)).strip()
            n = " ".join(PAL_JUNTA.get(w, w) for w in n.split())
            if n:
                materias.append(n)
        elif materias and not re.match(r'^\s*[\d°]', linea) and "Cód." not in linea:
            # continuación de un nombre cortado (p.ej. "Profesión", "praxis docente")
            cont = limpiar(" ".join(linea.split())).strip()
            mayo = cont == cont.upper() and len(cont) > 6
            if 0 < len(cont) < 60 and not mayo and not re.match(r'^(a\.|b\.|Título|Facultad*|Cód|Régimen|Carga|Requisito)', cont, re.I):
                materias[-1] = materias[-1] + " " + cont
                if len(materias[-1]) > 90:
                    materias[-1] = " ".join(materias[-1].split())
    if materias:
        tramos.append(materias)
    return tramos


def parsear(pdf_path):
    filas = filas_bbox(pdf_path)
    lineas = agrupar_lineas(filas)
    fix = CORRUPTS.get(pdf_path.split("/")[-1].replace(".pdf", ""), {})
    header_re = re.compile(r'^(Primer|Segundo|Tercer|Cuarto|Quinto)\s+(Semestre|Cuatrimestre)$')
    tramos = []
    corriente_actual = None   # tramo (año) en curso
    materias = []             # materias del tramo en curso
    ultima = ""               # materia abierta por si hay continuación
    anomalos = []

    def push_tramo():
        nonlocal materias, corriente_actual
        if materias:
            tramos.append(materias)
        materias = []

    for p, y, ws in lineas:
        ws_sorted = sorted(ws)
        # separar marcador vertical (x < 130, "AÑO"/"N°")
        body = [(x, xe, t) for x, xe, t in ws_sorted if not (x < 130 and MARCADOR_RE.match(t))]
        marcador = [t for x, xe, t in ws_sorted if x < 130 and MARCADOR_RE.match(t)]
        if not body:
            continue
        x0 = body[0][0]
        texto = " ".join(t for _, _, t in body)
        # ¿Header de semestre?
        if header_re.match(texto.strip()) and len(body) <= 3:
            if current := texto.split()[0]:
                if re.match(r'^Primer', texto):
                    push_tramo()
                    corriente_actual = "Año"
                    materia_ok = "inicio"
                # Segundo/Cuarto etc: mismo tramo, sigo juntando
            continue
        # ¿Materia? primer token = código numérico de 1-2 dígitos
        cod = None
        idx = None
        for i, (x, xe, t) in enumerate(body):
            if re.match(r'^\d{1,2}$', t):
                cod = t
                idx = i
                break
        if cod and corriente_actual:
            nombre = []
            x_prev = body[idx][1]
            for x, xe, t in body[idx + 1:]:
                if x - x_prev > 30:
                    break
                if t in REGIMENES or re.match(r'^[\d,\-–—\s:]+$', t):
                    break
                nombre.append(t)
                x_prev = xe
            tn = limpiar(" ".join(nombre)).strip()
            tn = " ".join(PAL_JUNTA.get(w, w) for w in tn.split())
            if tn:
                if es_anomalo(tn):
                    anomalos.append((cod, tn))
                    tn = fix.get(cod, tn)
                materias.append(tn)
                ultima = tn
        elif x0 > 135 and not cod and corriente_actual and ultima and not re.match(r'^(Primer|Segundo|Tercer|Cuarto)', texto):
            # continuación de materia anterior (p.ej. "Mundial", "e Inicial")
            cont = limpiar(texto.strip())
            if len(cont.split()) <= 4 and len(cont) < 30 and not es_anomalo(cont):
                materias[-1] = materias[-1] + " " + cont
                ultima = materias[-1]

    push_tramo()
    return aplicar_corruptos(pdf_path, tramos), anomalos


HEADER_SEM_RE = re.compile(r'^\s*(Primer|Segundo|Tercer|Cuarto|Quinto)\s+(Semestre|Cuatrimestre)\s*$')


def tiene_semestres(pdf_path):
    txt = subprocess.run(["pdftotext", "-layout", pdf_path, "-"],
                         capture_output=True, text=True).stdout
    return any(HEADER_SEM_RE.match(l) for l in txt.splitlines())


if __name__ == "__main__":
    for pdf in sys.argv[1:]:
        if tiene_semestres(pdf):
            tramos, anomalos = parsear(pdf)
            etiqueta = "sem"
        else:
            tramos = parsear_nuevo(pdf)
            anomalos = []
            etiqueta = "marcadores"
        print(f"\n=== {pdf.split('/')[-1]} f={etiqueta} tramos={len(tramos)} anomalos={len(anomalos)}")
        for k, t in enumerate(tramos):
            print(f"  Año {k+1}: {len(t)} materias")
            for mt in t:
                print(f"      - {mt}")
        for cod, tn in anomalos:
            print(f"  [ANOMALO #{cod}] {tn}")