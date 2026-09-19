import re
import time

from scraper_utils import carreras_guardadas, guardar_json, lineas_por_br, pedir_sopa


# El plan viene en una tabla, con dos formatos de la misma casa:
#   a) Código | Nombre del Espacio | Año | Cuat.  -> se agrupa por la columna Año.
#   b) Código | Unidades Curriculares | Correlativas (Turismo) -> no hay columna
#      Año: cada fila de la tabla es un año, en orden, y la celda trae las
#      materias separadas por <br>.
# En los dos, el nombre viene con el tipo pegado ("Biología General –
# Asignatura", "COMUNICACIÓN ORAL (TALLER)"); se recorta para dejar la materia.
RE_FORMATO = re.compile(
    r"\s*[–-]?\s*\(?\s*(?:asignatura|m[oó]dulo|taller|laboratorio|seminario|"
    r"pr[aá]ctica(?:\s*profesionalizante)?(?:\s*/\s*seminario)?)\s*\)?\s*$",
    re.I,
)


def _limpiar_materia(texto):
    limpio = RE_FORMATO.sub("", texto).strip()
    return limpio or texto.strip()


def extraer_plan(sopa):
    """Agrupa por año la tabla de espacios curriculares del 9-011."""
    for tabla in sopa.find_all("table"):
        filas = tabla.find_all("tr")
        if not filas:
            continue
        encabezado = [c.get_text(" ", strip=True).lower()
                      for c in filas[0].find_all(["th", "td"])]

        def indice(*nombres):
            for i, titulo in enumerate(encabezado):
                if any(n in titulo for n in nombres):
                    return i
            return None

        i_materia = indice("espacio", "unidades curriculares", "asignatura", "materia")
        if i_materia is None:
            continue
        i_anio = indice("año", "ano")

        grupos = {}
        if i_anio is not None:
            for fila in filas[1:]:
                celdas = [c.get_text(" ", strip=True) for c in fila.find_all(["td", "th"])]
                if len(celdas) <= max(i_materia, i_anio):
                    continue
                coincidencia = re.match(r"(\d{1,2})", celdas[i_anio])
                if not coincidencia:
                    continue
                nombre = _limpiar_materia(celdas[i_materia])
                if nombre:
                    grupos.setdefault(int(coincidencia.group(1)), []).append(nombre)
        else:
            for numero, fila in enumerate(filas[1:], start=1):
                celdas = fila.find_all(["td", "th"])
                if len(celdas) <= i_materia:
                    continue
                for linea in lineas_por_br(celdas[i_materia]):
                    nombre = _limpiar_materia(linea)
                    if nombre:
                        grupos.setdefault(numero, []).append(nombre)

        if grupos:
            return [{"anio": f"{a}º año", "materias": grupos[a]} for a in sorted(grupos)]
    return None


print("🛠️ Encendiendo el escáner V20 para IES 9-011 Del Atuel (San Rafael)...")
print("🔍 Leyendo números de chasis (URLs) para sacar los nombres exactos.\n")

carreras_viejas = carreras_guardadas("ies9011.json")
ies_data = {
    "id": 20,
    "nombre": "IES 9-011 Del Atuel",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0260-4422794",
        "email": "ies9011@infd.edu.ar",
        "direccion": "Maza 750, San Rafael, Mendoza"
    },
    "carreras": []
}

url_base = "https://ies9011-infd.mendoza.edu.ar/sitio/oferta-educativa/"
id_global = 2000 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Analizando las tablas de oferta en: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos todos los links de la página
    enlaces = sopa.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos para agarrar solo los links de carreras reales
        if "/sitio/profesorado" in link_oficial or "/sitio/tecnicatura" in link_oficial:
            carreras_procesadas.add(link_oficial)
            
            # --- MAGIA MECÁNICA: Transformamos el link en el nombre ---
            slug = link_oficial.strip('/').split('/')[-1]
            slug = re.sub(r'-\d+$', '', slug) # Borramos números sueltos del final
            
            nombre_carrera = slug.replace('-', ' ').title()
            
            # Prolijidad para las preposiciones
            for palabra in [' De ', ' En ', ' Y ', ' Con ', ' La ']:
                nombre_carrera = nombre_carrera.replace(palabra, palabra.lower())
                
            nombre_lower = nombre_carrera.lower()
            
            if nombre_carrera in carreras_viejas and carreras_viejas[nombre_carrera].get("plan_estudio"):
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Carrera detectada desde URL: {nombre_carrera}")
                
                if "profesorado" in nombre_lower:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                else:
                    categoria_actual = "Pregrado / Tecnicatura"
                    duracion_texto = "3 años"

                plan = None
                try:
                    time.sleep(0.4)
                    detalle = pedir_sopa(link_oficial)
                    if detalle:
                        plan = extraer_plan(detalle)
                except Exception:
                    pass
                guardada = carreras_viejas.get(nombre_carrera)
                if not plan and guardada:
                    plan = guardada.get("plan_estudio")
                registro = {
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "turno": "A confirmar",
                    "facultad": "IES 9-011 Del Atuel",
                    "link_oficial": link_oficial
                }
                if plan:
                    registro["plan_estudio"] = plan
                    registro["plan_fuente"] = link_oficial
                ies_data["carreras"].append(registro)
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo impecable! Se extrajeron {contador} carreras del IES 9-011.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-011: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9011.json")
print("🎉 Archivo 'ies9011.json' guardado correctamente.")