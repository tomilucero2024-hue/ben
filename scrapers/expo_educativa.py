"""Releva Expo Educativa 2026 y da de alta lo que falta en el catálogo.

Expo Educativa (expoeducativa.mendoza.edu.ar) es el listado oficial de la DGE
con las unidades académicas de Mendoza y su oferta 2026. Este scraper:

    1. recorre instituciones → unidades académicas → carreras,
    2. compara contra data.json (por institución destino y por nombre, con
       tolerancia a variantes: "Profesorado de Educación Inicial" vs. "en..."),
    3. pide el detalle de cada candidata y solo da de alta las que tienen
       nombre + categoría + duración + modalidad + link oficial que responde,
    4. escribe data/expo-instituciones.json con las instituciones nuevas y
       agrega las carreras nuevas a los JSON de las instituciones existentes,
    5. deja en data/expo-pendientes.json lo que quedó afuera y por qué.

Los vínculos unidad → institución del catálogo son curados (no adivinados):
la web de la Expo usa nombres administrativos ("IESDyT 9-001", "ISFDyT Nº
T-030") que ningún matcher resuelve bien, y una asignación equivocada manda
una carrera al instituto erróneo. Lo mismo con los nombres de fantasía de las
unidades nuevas, que se limpian en NOMBRES_NUEVOS.

Los links se verifican con la misma clasificación que scrapers/verificar_enlaces.py:
solo se acepta un link que responde (ok) o que existe pero bloquea bots
(bloqueado); un 404 o un dominio caído deja la carrera pendiente.

Correr con:  python scrapers/expo_educativa.py
"""

import html
import json
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup

from scraper_utils import DIR_DATOS, extraer_duracion, guardar_json, limpiar_estructura
from verificar_enlaces import clasificar

BASE = "https://expoeducativa.mendoza.edu.ar"
CABECERAS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}
ESPERA = 30
PAUSA = 0.12
TRABAJADORES_DETALLE = 6

# ---------------------------------------------------------------------------
# Curaduría: qué unidad de la Expo es qué institución del catálogo.
# ---------------------------------------------------------------------------
# Las facultades se mapean por institución padre: hay nombres repetidos entre
# universidades ("Facultad de Educación" existe en UNCuyo, UMaza y Champagnat)
# y mapear solo por nombre mandaba carreras al instituto equivocado.
MAPA_POR_INSTITUCION = {
    "Universidad Nacional de Cuyo": {
        "Facultad de Artes y Diseño": "__UNCUYO__",
        "Facultad de Ciencias Aplicadas a la Industria": "__UNCUYO__",
        "Facultad de Ciencias Económicas": "__UNCUYO__",
        "Facultad de Ciencias Médicas": "__UNCUYO__",
        "Facultad de Ciencias Políticas y Sociales": "__UNCUYO__",
        "Facultad de Educación": "__UNCUYO__",
        "Facultad de Filosofía y Letras": "__UNCUYO__",
        "Facultad de Ingeniería": "__UNCUYO__",
        "Facultad de Odontología": "__UNCUYO__",
        "Facultad de Derecho": "__UNCUYO__",
        "Facultad de Ciencias Exactas y Naturales": "__UNCUYO__",
        "Instituto Tecnológico Universitario": "ITU - Instituto Tecnológico Universitario (UNCuyo)",
        "Facultad de Ciencias Agrarias": "Facultad de Ciencias Agrarias - UNCuyo",
        "Instituto Balseiro": None,
        "Instituto Universitario de Seguridad Pública": None,
    },
    "Universidad del Aconcagua": {
        "Facultad de Cs. Sociales y Administrativas": "__UDA__",
        "Facultad de Psicología": "__UDA__",
        "Facultad de Cs. Económicas y Jurídicas": "__UDA__",
        "Facultad de Cs. Médicas": "__UDA__",
        "Escuela Superior de Lenguas Extranjeras": "__UDA__",
    },
    "Universidad de Mendoza": {
        "Facultad de Ingeniería": "__UM__",
        "Facultad de Ciencias Económicas": "__UM__",
        "Facultad de Ciencias Jurídicas y Sociales": "__UM__",
        "Facultad de Arquitectura, Urbanismo y Diseño": "__UM__",
        "Facultad de Ciencias de la Salud": "__UM__",
        "Facultad de Ciencias Médicas": "__UM__",
    },
    "Universidad de Congreso": {
        "Universidad de Congreso (UC)": "__UC__",
        "Facultad de Ciencias Jurídicas": "__UC__",
        "Facultad de Ciencias Económicas y de Administración": "__UC__",
        "Facultad de Ciencias de la Salud": "__UC__",
        "Facultad de Estudios Internacionales": "__UC__",
        "Facultad de Ambiente, Arquitectura y Urbanismo": "__UC__",
        "Facultad de Humanidades": "__UC__",
    },
    "Universidad Champagnat": {
        "Facultad de Ciencias Empresariales y Gestión Pública": "__UCH__",
        "Facultad de Derecho": "__UCH__",
        "Facultad de Informática y Diseño": "__UCH__",
        "Facultad de Educación": "__UCH__",
    },
    "UTN - Facultad Regional Mendoza": {"Facultad Regional Mendoza": "__UTN__"},
    "Universidad Juan Agustín Maza": {
        "Facultad de Farmacia y Bioquímica": "__UMAZA__",
        "Facultad de Ciencias de la Nutrición": "__UMAZA__",
        "Facultad de Ciencias Sociales y Comunicación": "__UMAZA__",
        "Facultad de Educación": "__UMAZA__",
        "Facultad de Kinesiología y Fisioterapia": "__UMAZA__",
        "Facultad de Ciencias Veterinarias y Ambientales": "__UMAZA__",
        "Facultad de Ingeniería y Enología": "__UMAZA__",
        "Centro de Artes y Oficios": "__UMAZA__",
    },
    "Pontificia Universidad Católica Argentina": {
        "Facultad de Humanidades y Ciencias Económicas": "__UCA__",
    },
    "IUCE - Inst. Universitario de Ciencias Empresariales": {
        "Nuestras carreras": "Instituto Univ. de Ciencias Empresariales (IUCE)",
    },
    "Fuerzas Armadas y de Seguridad": {
        "Armada Argentina": None,
        "Fuerza Aérea Argentina": None,
        "Ejército Argentino": None,
        "Gendarmería Nacional": None,
    },
    "Ciudad Universitaria": {"Ciudad Universitaria": None},
}

# Unidades de la DGE (padre único). Los códigos 9-0XX y PT-XXX no siempre
# están en el nombre del catálogo, por eso el mapeo es explícito.
MAPA_DGE = {
    "Escuela Regional Cuyo de Cine y Video IES N° 9-017": "Escuela Regional Cuyo de Cine y Video (IES 9-017)",
    "IES N° 9-004 Gral. Toribio de Luzuriaga": "IES 9-004 Gral. Toribio de Luzuriaga",
    "Instituto de Educación Superior N° 9-015 Valle de Uco": "IESVU (IES 9-015 Valle de Uco)",
    "ISFDyT Nº T-030 DEL BICENTENARIO": "IES 9-030 (Instituto del Bicentenario)",
    "Instituto de Educación Física N° 9-016": "IEF - Instituto de Educación Física (IES 9-016)",
    "Instituto de Educación Superior Nº 9-012 San Rafael en Informática": "IES 9-012 Informática",
    "IES N° 9-008 Manuel Belgrano": "IES 9-008 Manuel Belgrano",
    "Instituto de la Patria Grande N° 9-026": "IES 9-026 Instituto de la Patria Grande",
    "Instituto de Educación Superior N° 9-029": "IES 9-029 (Luján de Cuyo)",
    "Instituto de Educación Superior N° 9-024 Lavalle": "IES 9-024 (Lavalle)",
    "ISTEEC 9-013": "ISTEEC (IES 9-013)",
    "Instituto Rayuela PT 181": "Fundación Rayuela",
    "Escuela  Internacional Islas Malvinas PT 077": "Escuela Internacional Islas Malvinas",
    "Fundación Educativa Santísima Trinidad PT 155": "Instituto Santísima Trinidad",
    "Instituto Cultural de Mendoza PT 153": "Cultural Mendoza",
    "Instituto de Educación Superior Nº 9-027": "IES 9-027 (Guaymallén)",
    "Instituto ARTES F. Chopin PT-146": "Instituto de Arte Chopin",
    "Instituto Superior de Ciencias Biomédicas San Agustín": "Instituto San Agustín",
    "Instituto de Educación Superior 9-007 Dr. Salvador Calafat": "IES 9-007 Dr. Salvador Calafat (Gral. Alvear)",
    "IFDyT N° 9-006 Prof. Francisco Humberto Tolosa": "IES 9-006 Francisco H. Tolosa",
    "Instituto de Educación Superior N° 9-005 Fidela Amparán": "IES 9-005",
    "Instituto de Educación Superior N° 9-011 Del Atuel": "IES 9-011 Del Atuel",
    "IES Ntra Sra. del Rosario de Pompeya PT 068": "Instituto Superior",
    "Instituto de Educación Superior N° 9-009 Tupungato": "IES 9-009 (Tupungato)",
    "Fundación Fabián Calle": "Instituto Fabián Calle",
    "Instituto Profesorado de Arte N° 9-014 IPA": "IES 9-014 Profesorado de Arte (IPA)",
    "Escuela Superior de Periodismo Deportivo de Mendoza": "Escuela de Periodismo Deportivo de Mendoza (EPD)",
    "IES N° 9-002 Tomás Godoy Cruz": "IES 9-002 Tomás Godoy Cruz",
    "IES N° 9-010 Rosario Vera Peñaloza": "IES 9-010 Rosario Vera Peñaloza",
    "IES N° 9-028 Prof. Estela Susana Quiroga": "IES 9-028 (Santa Rosa)",
    "Instituto Superior Tecnológico Nº 9-019 INSUTEC": "INSUTEC (Instituto Superior de Educación Tecnológica)",
    "IES Nº 9-021 Tecnológico Junín": "IES 9-021 Tecnológico",
    "Instituto Superior de Formación Docente y Técnica N° 9-003 Normal Superior": "IES 9-003 Normal (San Rafael)",
    "Instituto de Educación Superior Nº 9-023": "IES 9-023",
    "IES Nº 9-018 Gdor. Celso Alejandro Jaque": "IES 9-018 (Malargüe)",
    "Instituto de Educación Superior y Técnico Nº 9-001 Gral. José de San Martín": "IES 9-001 Gral. José de San Martín",
    "IESDyT 9-001 - Gral. J. de San Martín": "IES 9-001 Gral. José de San Martín",
    "Instituto de Educación Superior Alvear IdESA UGACOOP": "IDESA - Instituto de Educación Superior Alvear (UGACOOP)",
    "Instituto Superior Juan Gutenberg Pt – 180": "Instituto Juan Gutenberg",
    "Escuela Superior de Psicología Social Mendoza": "Escuela de Psicología Social",
    # Los cursos de los CCT son formación laboral (catálogo aparte): no entran
    # como institución del catálogo formal. Quedan para una pasada de oficios.
    "Dirección de Técnica y Trabajo CCT/FP - IPCL": None,
}

MAPA_PADRES = {
    "__UNCUYO__": "Universidad Nacional de Cuyo (UNCuyo)",
    "__UDA__": "Universidad del Aconcagua (UDA)",
    "__UM__": "Universidad de Mendoza (UM)",
    "__UC__": "Universidad de Congreso (UC)",
    "__UCH__": "Universidad Champagnat (UCh)",
    "__UTN__": "UTN Facultad Regional Mendoza",
    "__UMAZA__": "Universidad Juan Agustín Maza (UMaza)",
    "__UCA__": "Universidad Católica Argentina (UCA)",
}

# Nombres de fantasía de las unidades nuevas, como van al catálogo.
NOMBRES_NUEVOS = {
    "NEOCAST PT 145": "NEOCAST (PT-145)",
    "Instituto Técnico Superior de Medicina China": "Instituto Técnico Superior de Medicina China",
    "IES  PT-160 Agentes de Propaganda Médica": "IES PT-160 Agentes de Propaganda Médica",
    "Don Bosco PT- 021": "Don Bosco (PT-021)",
    "Instituto Parroquial Nuestra Señora del Rosario Nivel Superior PT 005": "Instituto Parroquial Nuestra Señora del Rosario (PT-005)",
    "Instituto Superior de Educación Mendoza ISEM PT 252": "Instituto Superior de Educación Mendoza (ISEM)",
    "Instituto Fundación por el Arte": "Instituto Fundación por el Arte",
    "Instituto Cruz Roja Argentina Filial San Rafael PT-071": "Instituto Cruz Roja Argentina Filial San Rafael (PT-071)",
    "IES Nuevo Cuyo Mendoza PT 169": "IES Nuevo Cuyo Mendoza (PT-169)",
    "Inst. Sup. Reinalda Balancini": "Instituto Superior Reinalda Balancini",
    "Instituto Superior Nicolás Avellaneda": "Instituto Superior Nicolás Avellaneda",
    "Instituto de Ciencias Junín": "Instituto de Ciencias Junín",
    "Instituto Arrayanes": "Instituto Arrayanes",
    "Instituto Superior Fundación Universitas": "Instituto Superior Fundación Universitas",
    "Instituto Superior Isabel La Católica": "Instituto Superior Isabel La Católica",
    "Instituto Nuestra Señora del Rosario PT 094": "Instituto Nuestra Señora del Rosario (PT-094)",
    "Instituto de Desarrollo Laboral y Profesional PT-274": "Instituto de Desarrollo Laboral y Profesional (PT-274)",
    "Instituto Superior Juan Vucetich PT-177": "Instituto Superior Juan Vucetich (PT-177)",
    "Instituto IDICSA": "Instituto IDICSA",
    "Instituto Alfredo Bufano PT 215": "Instituto Alfredo Bufano (PT-215)",
    "Instituto Superior de la Uthgra (PT283) Unión de Trabajadores del Turismo, Hoteleros y Gastronómicos de la República Argentina.": "Instituto Superior de la UTHGRA (PT-283)",
    "PT 113 Tomás Alva Edison": "Instituto Tomás Alva Edison (PT-113)",
    "Instituto Superior Diocesano San José PT 164": "Instituto Superior Diocesano San José (PT-164)",
    "Instituto Superior ESAPA PT 166": "Instituto Superior ESAPA (PT-166)",
    "Instituto San Antonio PT 30": "Instituto San Antonio (PT-030)",
    "Dirección de Técnica y Trabajo CCT/FP - IPCL": "Dirección de Técnica y Trabajo CCT/FP - IPCL",
}

# Entradas de la Expo que no son carreras: son programas o áreas de servicio.
NO_CARRERAS = {"escuela de oficios", "centro de formacion tecnico profesional"}

# Modalidades canónicas del catálogo, en orden de detección.
MODALIDADES = (
    ("semipresencial", "Semipresencial"),
    ("presencial", "Presencial"),
    ("a distancia", "A distancia"),
    ("distancia", "A distancia"),
    ("hibrid", "Híbrido"),
    ("online", "Online"),
    ("virtual", "Virtual"),
    ("mixta", "Mixta"),
    ("bimodal", "Bimodal"),
)

# Un "link oficial" tiene que ser del instituto: si la única web publicada es
# un video, una planilla o una red social, la carrera queda pendiente.
HOSTS_NO_INSTITUCIONALES = (
    "youtube.com", "youtu.be", "docs.google.com", "drive.google.com",
    "forms.gle", "facebook.com", "instagram.com", "twitter.com", "x.com",
    "tiktok.com", "linktr.ee", "wa.me",
)

# Webs oficiales para unidades donde la Expo publica otro link (video, planilla).
WEB_POR_UNIDAD = {
    "Instituto de Ciencias Junín": "https://www.institutodejunin.edu.ar/",
    # El certificado HTTPS no valida: el sitio responde por HTTP.
    "Instituto San Antonio PT 30": "http://isaalvear.edu.ar/",
}

# Gestión para unidades nuevas donde la Expo no publica el badge y el nombre no
# trae código PT (los PT de la DGE son de gestión privada).
GESTION_NUEVAS = {
    "Instituto de Ciencias Junín": "privada",
    "Instituto Arrayanes": "privada",
    "Instituto Técnico Superior de Medicina China": "privada",
    "Instituto Superior Nicolás Avellaneda": "privada",
    "Instituto Fundación por el Arte": "privada",
    "Instituto Superior Isabel La Católica": "privada",
    "Instituto IDICSA": "privada",
    "Instituto Superior de la UTHGRA (PT-283)": "privada",
}

ARCHIVOS_SOBRECARGA = {
    "formaciones_alternativas.json", "oficios_tecnicos.json",
    "higiene_seguridad.json", "secundario.json",
}

DEPARTAMENTOS = [
    "Capital", "Godoy Cruz", "Guaymallén", "Las Heras", "Lavalle", "Luján de Cuyo",
    "Maipú", "San Martín", "Junín", "Rivadavia", "Santa Rosa", "La Paz",
    "Tunuyán", "Tupungato", "San Carlos", "Malargüe", "San Rafael", "General Alvear",
]

STOP = {
    "de", "del", "la", "el", "los", "las", "y", "en", "a", "al", "para", "con",
    "por", "superior", "universitaria", "universitario", "universitarias",
    "universitarios", "tecnicatura", "tecnico", "tecnica", "ts", "instituto",
    "ies", "profesional", "pregrado", "grado", "profesorado", "licenciatura",
    "licenciado", "licenciada", "lic", "ciclo", "ciclos", "complementacion",
    "curricular", "orientacion", "opcion", "modalidad", "presencial",
    "distancia", "virtual", "online", "turno", "manana", "tarde", "noche",
    "ciencias", "basicas", "basica",
}

# Nombres que se parecen a una carrera ya cargada pero son otra cosa: no se
# descartan como duplicado. Son variantes revisadas a mano.
# Carreras que la Expo todavía lista con el plan viejo y que en el catálogo ya
# viven con el nombre nuevo: no se vuelven a dar de alta.
CARRERAS_REEMPLAZADAS = {
    ("IES 9-008 Manuel Belgrano", "tecnicatura superior en diseno multimedial"),
}

NO_SON_DUPLICADO = (
    "licenciatura en historia de las artes plasticas",
    "licenciatura en ciencia politica y administracion publica",
    "profesorado universitario en historia",
    "licenciatura en administracion gastronomica",
    "licenciatura en administracion hotelera",
    "licenciatura en administracion de salud",
)

# Palabras que agregan contexto, no una carrera distinta: si un nombre es el
# otro más alguno de estos términos, es la misma oferta.
CALIFICADORES = {
    "gestion", "nacional", "hoteleria", "hotelera", "educacion", "secundaria",
    "primaria", "inicial", "canto", "instrumentos", "direccion", "coral",
    "composicion", "popular", "publico", "lengua", "sistemas",
}

# Variantes que en la Expo y en el catálogo nombran la misma carrera.
SINONIMOS = (
    ("nivel inicial", "educacion inicial"),
    ("nivel primario", "educacion primaria"),
    ("nivel primaria", "educacion primaria"),
    ("nivel secundario", "educacion secundaria"),
    ("nivel secundaria", "educacion secundaria"),
    ("frutihorticolas", "alimentos"),
    ("ambiental", "ambiente"),
    ("acompanamiento", "acompanante"),
    ("eletromecanica", "electromecanica"),
    ("lienciatura", "licenciatura"),
    ("locucion de radio y television", "locucion"),
    ("analisis y programacion de sistemas", "analista programador"),
    ("comercializacion con orientacion internacionales", "marketing internacional"),
)

WRAPPERS = {"lic", "licenciatura", "licenciado", "licenciada", "ingenieria",
            "tecnicatura", "tecnico", "tecnica", "ts", "profesorado"}


# ---------------------------------------------------------------------------
# Texto
# ---------------------------------------------------------------------------

def normalizar(texto):
    texto = unicodedata.normalize("NFD", str(texto or ""))
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9]+", " ", texto.lower())
    return re.sub(r"\s+", " ", texto).strip()


def tokens(texto):
    """Palabras que identifican la carrera, sin envoltorios de título.

    "Licenciatura en Comunicación" y "Comunicación" comparten tokens: son la
    misma carrera con distinto rótulo. Los sinónimos y typos de la fuente
    también se normalizan acá ("Nivel Inicial" = "Educación Inicial",
    "Lienciatura" = "Licenciatura").
    """
    n = normalizar(texto)
    for original, reemplazo in SINONIMOS:
        n = n.replace(normalizar(original), normalizar(reemplazo))
    return {t for t in n.split() if t not in STOP and len(t) > 1}


def similitud(a, b):
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def nivel_de_nombre(nombre):
    """Grado/pregrado/profesorado según el nombre, o None si no lo dice."""
    n = normalizar(nombre)
    if "profesorado" in n:
        return "profesorado"
    if any(p in n for p in WRAPPERS):
        if "lic" in n.split() or "licenciatura" in n or "ingenieria" in n:
            return "grado"
        if any(p in n for p in ("tecnicatura", "tecnico", "tecnica", "ts")):
            return "pregrado"
    return None


def duplicado(nuevo, existente):
    """True si son la misma carrera con distinto envoltorio de título.

    Si los dos nombres declaran niveles distintos (licenciatura vs.
    tecnicatura) se consideran carreras diferentes: muchas instituciones
    ofrecen las dos.
    """
    n = normalizar(nuevo)
    if n == normalizar(existente):
        return True
    if any(excepcion in n for excepcion in NO_SON_DUPLICADO):
        return False
    cn, ce = tokens(nuevo), tokens(existente)
    if not cn or not ce:
        return False
    nivel_nuevo, nivel_existente = nivel_de_nombre(nuevo), nivel_de_nombre(existente)
    if nivel_nuevo and nivel_existente and nivel_nuevo != nivel_existente:
        return False
    if cn == ce:
        return True
    if "instrumento" in cn and "instrumento" in ce:
        return True
    if len(cn & ce) / len(cn | ce) >= 0.7:
        return True
    menor, mayor = (cn, ce) if len(cn) <= len(ce) else (ce, cn)
    return menor <= mayor and (mayor - menor) <= CALIFICADORES


def duracion_expo(bruto):
    """Normaliza la duración de una ficha de Expo ('Tres (3) años', '450 horas reloj')."""
    texto = html.unescape(bruto or "")
    texto = re.sub(r"<[^>]+>", " ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    # "Tres (3) años" -> "3 años"  /  "4 (cuatro años) años" -> "4 años"
    texto = re.sub(r"([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s*\((\d{1,2})\)", r"\2", texto)
    texto = re.sub(r"(\d{1,2})\s*\([A-Za-zÁÉÍÓÚáéíóúÑñ ]+\)", r"\1", texto)

    # Un trayecto "2/3 años" es un rango: no se publica un número elegido a mano.
    if re.search(r"\d\s*/\s*\d\s*a", texto, re.I):
        return None

    hallado = extraer_duracion(texto)
    if hallado:
        return hallado

    # "El curso dura aproximadamente 7 meses"
    m = re.search(
        r"dura(?:ci[oó]n)?\s+(?:aproximadamente\s+|alrededor de\s+)?"
        r"(\w+|\d+)\s*(años?|meses?|semestres?|cuatrimestres?)",
        texto, re.I,
    )
    if m:
        hallado = extraer_duracion("duracion " + m.group(1) + " " + m.group(2))
        if hallado:
            return hallado

    # Último recurso: el primer número con unidad de tiempo en la sección Duración.
    m = re.search(
        r"(\d{1,2}(?:[.,]\d+)?)\s*(años?|meses?|semestres?|cuatrimestres?|horas?(?:\s*(?:reloj|c[áa]tedra))?)",
        texto, re.I,
    )
    if not m:
        return None
    numero = m.group(1).replace(",", ".")
    valor = int(float(numero)) if float(numero).is_integer() else float(numero)
    unidad = m.group(2).lower()
    if unidad.startswith("año"):
        return f"{valor} {'año' if valor == 1 else 'años'}"
    if unidad.startswith("mes"):
        return f"{valor} {'mes' if valor == 1 else 'meses'}"
    if unidad.startswith("semestre"):
        return f"{valor} semestre{'s' if valor != 1 else ''}"
    if unidad.startswith("cuatrimestre"):
        return f"{valor} cuatrimestre{'s' if valor != 1 else ''}"
    sufijo = " reloj" if "reloj" in unidad else " cátedra" if "cátedra" in unidad else ""
    return f"{valor} {'hora' if valor == 1 else 'horas'}{sufijo}"


def categoria_de(nombre, nivel):
    n = normalizar(nombre)
    if "profesorado" in n:
        return "Grado / Profesorado"
    if "tecnicatura" in n or n.split()[0] in ("tecnico", "tecnica", "ts"):
        return "Pregrado / Tecnicatura"
    if "licenciatura" in n or n.startswith("lic ") or "ingenieria" in n:
        return "Grado / Licenciatura"
    if any(x in n for x in ("maestria", "especializacion", "posgrado", "doctorado",
                            "actualizacion", "postitulo", "diplomatura")):
        return "Posgrado / Especialización"
    if "curso" in n or "taller" in n or "capacitacion" in n:
        return "Curso / Formación Profesional"
    return "Grado / Carrera" if "grado" in (nivel or "") else "Pregrado / Tecnicatura"


def badges_de(cabecera):
    """Extrae (modalidad, gestión, nivel) de los badges estructurados.

    La cabecera es "Carrera | nombre | descripción | área | nivel | gestión |
    modalidad". Buscar "Modalidad"/"Gestión" dentro de toda la cabecera da
    falsos positivos cuando la descripción dice "escuelas de gestión estatal o
    privada" o "bajo la Modalidad de Educación Especial": por eso solo se miran
    las últimas cuatro partes, que son donde viven los badges.
    """
    partes = [p.strip() for p in (cabecera or "").split("|") if p.strip()]
    cola = partes[-4:]
    modalidad = gestion = nivel = None
    for parte in reversed(cola):
        if modalidad is None:
            m = re.match(r"^Modalidad\s+(.+)$", parte, re.I)
            if m:
                modalidad = m.group(1).strip()
        if gestion is None:
            m = re.match(r"^Gesti[oó]n\s+(.+)$", parte, re.I)
            if m:
                gestion = m.group(1).strip()
        if nivel is None and normalizar(parte) in ("grado", "pregrado", "posgrado", "tecnicatura", "curso"):
            nivel = normalizar(parte)
    return modalidad, gestion, nivel


def modalidad_valida(bruta):
    """Devuelve la modalidad canónica o None si el texto no es una modalidad."""
    n = normalizar(bruta)
    for clave, canonica in MODALIDADES:
        if n.startswith(normalizar(clave)) or normalizar(clave) in n.split():
            return canonica
    return None


def gestion_catalogo(texto):
    n = normalizar(texto)
    if "estatal" in n:
        return "pública"
    if "privad" in n:
        return "privada"
    return None


def normalizar_web(url):
    if not url:
        return None
    url = url.strip()
    if url.startswith("www."):
        url = "https://" + url
    if not url.startswith("http"):
        return None
    if any(host in url for host in HOSTS_NO_INSTITUCIONALES):
        return None
    return url


def departamento_de(texto):
    """Deduce el departamento del nombre de la unidad o de la dirección.

    En las direcciones la calle puede llamarse como un departamento ("Maipú
    324" queda en Capital, no en Maipú): se recorre desde el final, que es
    donde va la localidad, y "Ciudad" cuenta como Capital.
    """
    if not texto:
        return None
    partes = [p.strip() for p in re.split(r"[,;]", texto) if p.strip()]
    for parte in reversed(partes):
        n = normalizar(parte)
        if n in ("mendoza", "argentina", "mendoza argentina"):
            continue
        if re.search(r"\bciudad\b", n):
            return "Capital"
        for departamento in DEPARTAMENTOS:
            if normalizar(departamento) in n:
                return departamento
    n = normalizar(texto)
    if re.search(r"\bciudad\b", n):
        return "Capital"
    for departamento in DEPARTAMENTOS:
        if normalizar(departamento) in n:
            return departamento
    return None


# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------

def pedir_sopa(url):
    respuesta = requests.get(url, headers=CABECERAS, timeout=ESPERA)
    respuesta.raise_for_status()
    return BeautifulSoup(respuesta.text, "html.parser")


def recolectar():
    """Instituciones → unidades académicas → carreras listadas."""
    raiz = pedir_sopa(f"{BASE}/instituciones")
    ids_instituciones = sorted({int(m.group(1)) for m in re.finditer(r"/institucion/(\d+)", str(raiz))})

    unidades = {}
    for institucion_id in ids_instituciones:
        sopa = pedir_sopa(f"{BASE}/institucion/{institucion_id}")
        h2 = sopa.find("h2", class_=lambda c: c and "encabezado_subtitulo" in c)
        nombre_institucion = h2.get_text(strip=True) if h2 else f"institución {institucion_id}"
        ids_unidades = sorted({int(m.group(1)) for m in re.finditer(r"/uacademica/(\d+)", str(sopa))})
        for unidad_id in ids_unidades:
            time.sleep(PAUSA)
            detalle = pedir_sopa(f"{BASE}/uacademica/{unidad_id}")
            h2u = detalle.find("h2", class_=lambda c: c and "encabezado_subtitulo" in c)
            nombre_unidad = h2u.get_text(strip=True) if h2u else f"unidad {unidad_id}"
            web_unidad = None
            for a in detalle.find_all("a", href=True):
                href = a["href"]
                if href.startswith("http") and not any(
                    x in href for x in ("expoeducativa", "mendoza.edu.ar", "facebook",
                                        "twitter", "instagram", "wa.me", "maps.google")
                ):
                    web_unidad = href
                    break
            carreras = []
            for a in detalle.find_all("a", href=True):
                coincidencia = re.search(r"/carrera/(\d+)", a["href"])
                if coincidencia:
                    carreras.append({"id": int(coincidencia.group(1)), "nombre": a.get_text(" ", strip=True)})
            unidades[unidad_id] = {
                "id": unidad_id,
                "nombre": nombre_unidad,
                "institucion": nombre_institucion,
                "institucion_id": institucion_id,
                "web": web_unidad,
                "carreras": carreras,
            }
        print(f"  {nombre_institucion[:52]:54} {len(ids_unidades):3} unidades")
    return unidades


def detalle_carrera(carrera_id):
    sopa = pedir_sopa(f"{BASE}/carrera/{carrera_id}")
    h2 = sopa.find("h2", class_=lambda c: c and "encabezado_subtitulo" in c)
    if h2 is None:
        return None
    cabecera = h2.find_parent().get_text(" | ", strip=True)

    secciones = {}
    for titulo in sopa.find_all("h2", class_=lambda c: c and "section_titulo" in c):
        contenedor = titulo.find_parent()
        if contenedor:
            secciones[titulo.get_text(strip=True)] = contenedor.get_text(" ", strip=True)

    unidad = None
    web = None
    direccion = None
    email = None
    titulo_unidad = sopa.find("h2", string=re.compile("Unidad Académica", re.I))
    if titulo_unidad:
        contenedor = titulo_unidad.find_parent()
        texto = contenedor.get_text(" | ", strip=True)
        m = re.search(r"Unidad Académica \| ([^|]+)", texto)
        unidad = m.group(1).strip() if m else None
        partes = re.split(r"Unidad Académica\s*\|", texto, maxsplit=1)
        cola = partes[-1]
        cola = re.sub(r"^\s*" + re.escape(unidad or ""), "", cola, count=1)
        cola = re.split(r"\|\s*(?:Email|Web|facebook|twitter|instagram)", cola)[0]
        direccion = re.sub(r"^[\s|·]+|[\s|·]+$", "", cola).strip() or None
        for a in contenedor.find_all("a", href=True):
            href = a["href"]
            if href.startswith("mailto:"):
                correo = re.search(r"[\w.+-]+@[\w-]+\.[A-Za-z]{2,}", href)
                email = email or (correo.group(0) if correo else None)
                continue
            if href.startswith("http") and not any(
                x in href for x in ("expoeducativa", "mendoza.edu.ar", "facebook",
                                    "twitter", "instagram", "wa.me", "maps.google")
            ):
                web = web or href
    if web is None:
        for a in sopa.find_all("a", href=True):
            if a.get_text(" ", strip=True).lower() == "más información":
                web = a["href"]
                break

    plan = secciones.get("Plan de estudios", "")
    return {
        "id": carrera_id,
        "nombre": h2.get_text(strip=True).rstrip("."),
        "cabecera": cabecera,
        "descripcion": secciones.get("Descripción", ""),
        "duracion": secciones.get("Duración", ""),
        "unidad": unidad,
        "web": web,
        "email": email,
        "direccion": direccion,
        "plan": plan,
    }


# ---------------------------------------------------------------------------
# Cruce con el catálogo
# ---------------------------------------------------------------------------

def cargar_catalogo():
    """data.json + el archivo fuente de cada institución (para poder agregar)."""
    with open(DIR_DATOS / "data.json", "r", encoding="utf-8") as archivo:
        catalogo = json.load(archivo)

    por_nombre = {i["nombre"]: i for i in catalogo["instituciones"]}
    candidatos = {}
    for ruta in sorted(DIR_DATOS.glob("*.json")):
        if ruta.name in ("data.json", "expo-pendientes.json", "expo-instituciones.json"):
            continue
        try:
            with open(ruta, "r", encoding="utf-8") as archivo:
                datos = json.load(archivo)
        except (json.JSONDecodeError, OSError):
            continue
        for institucion in datos.get("instituciones", []):
            if not isinstance(institucion, dict):
                continue
            nombre = institucion.get("nombre")
            if not nombre:
                continue
            candidatos.setdefault(nombre, []).append((ruta, datos, institucion))

    # Varias instituciones aparecen también en los archivos de los catálogos
    # aparte (por ejemplo INSUTEC en higiene_seguridad.json). El archivo propio
    # es el que no es una sobrecarga; si hay más de uno, se deja sin tocar.
    archivos = {}
    for nombre, opciones in candidatos.items():
        if len(opciones) == 1:
            archivos[nombre] = opciones[0]
            continue
        propias = [o for o in opciones if o[0].name not in ARCHIVOS_SOBRECARGA]
        if len(propias) == 1:
            archivos[nombre] = propias[0]
        else:
            print(f"⚠️  '{nombre}' está en {', '.join(o[0].name for o in opciones)}: altas sin escribir.")
            archivos[nombre] = (opciones[0][0], None, None)
    return catalogo, por_nombre, archivos


def destino_de(unidad):
    """Devuelve (nombre destino en catálogo, es_nueva). None = fuera de alcance."""
    nombre = unidad["nombre"]
    padre = unidad["institucion"] or ""
    if padre in MAPA_POR_INSTITUCION:
        destino = MAPA_POR_INSTITUCION[padre].get(nombre)
        if destino is None:
            return None
        return MAPA_PADRES.get(destino, destino), False
    if "Dirección General de Escuelas" in padre:
        if nombre in MAPA_DGE:
            destino = MAPA_DGE[nombre]
            if destino is None:
                return None
            return destino, False
        return NOMBRES_NUEVOS.get(nombre, nombre), True
    return None


def webs_de_respaldo(catalogo):
    """Dominio más usado por institución en el catálogo, como último recurso.

    Para las unidades del INFd la Expo no publica web y la ficha de la carrera
    tampoco: el catálogo ya tiene el dominio real en las carreras cargadas.
    """
    respaldo = {}
    for institucion in catalogo["instituciones"]:
        dominios = {}
        for carrera in institucion.get("carreras", []):
            coincidencia = re.match(r"https?://([^/]+)", carrera.get("link_oficial") or "")
            if coincidencia:
                dominios[coincidencia.group(1)] = dominios.get(coincidencia.group(1), 0) + 1
        if dominios:
            host = max(dominios, key=dominios.get)
            respaldo[institucion["nombre"]] = f"https://{host}/"
    return respaldo


def duplicado_en_catalogo(destino, nombre, planes):
    base = planes.get("__catalogo__", {}).get(destino, [])
    for existente in base:
        if duplicado(nombre, existente):
            return existente
    return None


def es_no_carrera(nombre):
    n = normalizar(nombre)
    return (n in NO_CARRERAS or "oportunidades laborales" in n
            or n.startswith("x ") or "nuevos cursos" in n)


def guardar_respetando_sangria(datos, ruta):
    """Reescribe un JSON de institución conservando su indentación original.

    guardar_json() usa indent=4, pero varios archivos del repo vienen con
    indent=1: reescribirlos enteros genera cientos de líneas de ruido en el
    diff que tapan las altas de verdad.
    """
    original = ruta.read_text(encoding="utf-8") if ruta.exists() else ""
    coincidencia = re.search(r"\n( +)\"", original)
    sangria = len(coincidencia.group(1)) if coincidencia else 4
    texto = json.dumps(limpiar_estructura(datos), ensure_ascii=False, indent=sangria)
    ruta.write_text(texto + ("\n" if original.endswith("\n") else ""), encoding="utf-8")


def main():
    print("🔭 Relevando Expo Educativa 2026...")
    catalogo, por_nombre, archivos = cargar_catalogo()
    respaldos = webs_de_respaldo(catalogo)
    unidades = recolectar()

    # Nombres ya cargados por institución, para el dedupe difuso.
    planes = {"__catalogo__": {}}
    for nombre, institucion in por_nombre.items():
        planes["__catalogo__"][nombre] = [
            c.get("nombre_carrera") or c.get("nombre") for c in institucion.get("carreras", [])
        ]

    candidatas = []  # (unidad, destino, es_nueva, carrera_listada)
    duplicadas = []
    for unidad in unidades.values():
        resuelto = destino_de(unidad)
        if resuelto is None:
            continue
        destino, es_nueva = resuelto
        vistos = []
        for carrera in unidad["carreras"]:
            nombre = carrera["nombre"]
            if es_no_carrera(nombre):
                continue
            if not es_nueva and (destino, normalizar(nombre)) in CARRERAS_REEMPLAZADAS:
                continue
            if not es_nueva:
                repetida = duplicado_en_catalogo(destino, nombre, planes)
                if repetida:
                    if normalizar(nombre) != normalizar(repetida):
                        duplicadas.append({
                            "nombre": nombre, "destino": destino, "unidad": unidad["nombre"],
                            "faltan": [f"posible duplicado de «{repetida}»"],
                        })
                    continue
            if any(duplicado(nombre, visto) for visto in vistos):
                continue
            vistos.append(nombre)
            candidatas.append((unidad, destino, es_nueva, carrera))

    print(f"\n🔎 {len(candidatas)} candidatas a verificar (detalle y link)...")

    ids = sorted({c["id"] for _, _, _, c in candidatas})
    detalles = {}
    with ThreadPoolExecutor(max_workers=TRABAJADORES_DETALLE) as ejecutor:
        for procesadas, (carrera_id, detalle) in enumerate(
            zip(ids, ejecutor.map(detalle_carrera, ids)), start=1
        ):
            detalles[carrera_id] = detalle
            if procesadas % 25 == 0:
                print(f"   … {procesadas}/{len(ids)} fichas")

    links = {}
    nuevas = {}
    altas = {}
    pendientes = []
    for unidad, destino, es_nueva, carrera in candidatas:
        detalle = detalles.get(carrera["id"])
        if not detalle:
            pendientes.append({"expo_id": carrera["id"], "nombre": carrera["nombre"],
                               "destino": destino, "faltan": ["ficha"], "unidad": unidad["nombre"]})
            continue

        if "en proceso" in normalizar(detalle["nombre"]):
            pendientes.append({
                "expo_id": carrera["id"], "nombre": detalle["nombre"], "destino": destino,
                "unidad": unidad["nombre"], "faltan": ["oferta no vigente"], "web": None,
            })
            continue

        duracion = duracion_expo(detalle["duracion"])
        modalidad_bruta, gestion_bruta, nivel = badges_de(detalle["cabecera"])
        modalidad = modalidad_valida(modalidad_bruta)
        web = normalizar_web(
            WEB_POR_UNIDAD.get(unidad["nombre"]) or detalle.get("web")
            or unidad.get("web") or respaldos.get(destino)
        )

        faltan = [campo for campo, valor in
                  (("duracion", duracion), ("modalidad", modalidad)) if not valor]
        if not web:
            faltan.append("web (o no institucional)")
        elif web not in links:
            links[web] = clasificar(web)[0]
        if web and links.get(web) not in ("ok", "bloqueado"):
            faltan.append(f"link {links.get(web)}")

        if faltan:
            pendientes.append({
                "expo_id": carrera["id"], "nombre": detalle["nombre"], "destino": destino,
                "unidad": unidad["nombre"], "faltan": faltan,
                "duracion_bruta": (detalle["duracion"] or "")[:120], "web": web,
            })
            continue

        registro = {
            "nombre_carrera": detalle["nombre"],
            "categoria": categoria_de(detalle["nombre"], nivel),
            "duracion": duracion,
            "modalidad": modalidad,
            "facultad": unidad["nombre"],
            "link_oficial": web,
        }
        if es_nueva:
            nuevas.setdefault((destino, unidad["nombre"]), []).append(registro)
        else:
            altas.setdefault(destino, []).append(registro)

    # --- Instituciones nuevas -------------------------------------------------
    ids_libres = 52
    catalogo_nuevas = []
    for (destino, unidad_nombre), carreras in sorted(nuevas.items()):
        unidad = next(u for u in unidades.values() if u["nombre"] == unidad_nombre)
        detalle_muestra = next((detalles[c["id"]] for c in unidad["carreras"] if c["id"] in detalles), {})
        _, gestion_bruta, _ = badges_de(detalle_muestra.get("cabecera", ""))
        gestion = GESTION_NUEVAS.get(destino) or gestion_catalogo(gestion_bruta)
        if gestion is None and re.search(r"\bpt\s*\d+\b", normalizar(unidad_nombre)):
            gestion = "privada"
        if gestion is None:
            gestion = "A confirmar"
        institucion = {
            "id": ids_libres,
            "nombre": destino,
            "nivel": "terciario",
            "gestion": gestion,
            "provincia": "Mendoza",
            "contacto": {
                "telefono": "A confirmar",
                "email": detalle_muestra.get("email") or "A confirmar",
                "direccion": detalle_muestra.get("direccion") or "A confirmar",
            },
            "carreras": [],
        }
        departamento = departamento_de(unidad_nombre) or departamento_de(detalle_muestra.get("direccion") or "")
        if departamento:
            institucion["departamento"] = departamento
        for indice, carrera in enumerate(sorted(carreras, key=lambda c: c["nombre_carrera"]), start=1):
            registro = dict(carrera)
            registro["id"] = ids_libres * 100 + indice
            institucion["carreras"].append(registro)
        catalogo_nuevas.append(institucion)
        ids_libres += 1

    guardar_json({"instituciones": catalogo_nuevas}, "expo-instituciones.json")

    # --- Altas a instituciones existentes ------------------------------------
    agregadas = 0
    for destino, carreras in sorted(altas.items()):
        entrada = archivos.get(destino)
        if not entrada or entrada[1] is None:
            print(f"⚠️  No encuentro el JSON fuente de '{destino}': {len(carreras)} altas sin escribir.")
            continue
        ruta, datos, institucion = entrada
        existentes = [c.get("nombre_carrera") or c.get("nombre") for c in institucion.get("carreras", [])]
        siguiente_id = max((c.get("id", 0) for c in institucion.get("carreras", [])), default=0) + 1
        for carrera in sorted(carreras, key=lambda c: c["nombre_carrera"]):
            if any(duplicado(carrera["nombre_carrera"], existente) for existente in existentes):
                continue
            registro = dict(carrera)
            registro["id"] = siguiente_id
            siguiente_id += 1
            institucion["carreras"].append(registro)
            existentes.append(registro["nombre_carrera"])
            agregadas += 1
        guardar_respetando_sangria(datos, ruta)
        print(f"   ✚ {destino}: {len(carreras)} candidatas → {ruta.name}")

    pendientes.extend(duplicadas)
    pendientes.sort(key=lambda p: (p["destino"], p["nombre"]))
    with open(DIR_DATOS / "expo-pendientes.json", "w", encoding="utf-8") as archivo:
        json.dump({"generado_por": "scrapers/expo_educativa.py", "pendientes": pendientes},
                  archivo, ensure_ascii=False, indent=2)

    print(f"\n🎉 Expo Educativa: {len(catalogo_nuevas)} instituciones nuevas "
          f"({sum(len(i['carreras']) for i in catalogo_nuevas)} carreras), "
          f"{agregadas} carreras sumadas a instituciones existentes, "
          f"{len(pendientes)} pendientes por datos o link.")


if __name__ == "__main__":
    main()
