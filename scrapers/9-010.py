import re

from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V19 para IES 9-010 Rosario Vera Peñaloza...")
print("🔍 Set up: Extracción de nombres por número de chasis (URL) activada.\n")

carreras_viejas = carreras_guardadas("ies9010.json")
ies_data = {
    "id": 19,
    "nombre": "IES 9-010 Rosario Vera Peñaloza",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "02622-451458",
        "email": "ies9010@infd.edu.ar",
        "direccion": "Ruta Nacional 40 Km 3193, Eugenio Bustos, San Carlos"
    },
    "carreras": []
}

# Si la oferta educativa está en otra pestaña, cambiá este link por el exacto
url_base = "https://ies9010-infd.mendoza.edu.ar/sitio/"
id_global = 1900 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Entrando a buscar imágenes con link en: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos todos los links
    enlaces = sopa.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos que sea un link interno de Mendoza y que tenga la palabra clave
        if "/sitio/profesorado" in link_oficial or "/sitio/tecnicatura" in link_oficial:
            carreras_procesadas.add(link_oficial)
            
            # --- MAGIA MECÁNICA: Convertimos la URL en el nombre de la carrera ---
            # 1. Sacamos lo último del link (ej: tecnicatura-superior-en-computacion-y-redes-2)
            slug = link_oficial.strip('/').split('/')[-1]
            
            # 2. Le borramos los números finales molestos como el "-2"
            slug = re.sub(r'-\d+$', '', slug)
            
            # 3. Cambiamos guiones por espacios y ponemos mayúsculas
            nombre_carrera = slug.replace('-', ' ').title()
            
            # 4. Prolijidad para las palabras chiquitas
            for palabra in [' De ', ' En ', ' Y ']:
                nombre_carrera = nombre_carrera.replace(palabra, palabra.lower())
                
            nombre_lower = nombre_carrera.lower()
            
            if nombre_carrera in carreras_viejas:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Carrera detectada desde URL: {nombre_carrera}")
                
                # Asignamos duración como me pediste
                if "profesorado" in nombre_lower:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                else:
                    categoria_actual = "Pregrado / Tecnicatura"
                    duracion_texto = "3 años"
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "turno": "A confirmar",
                    "facultad": "IES 9-010 Rosario Vera Peñaloza",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Bujías limpias! Se extrajeron {contador} carreras del IES 9-010.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-010: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9010.json")
print("🎉 Archivo 'ies9010.json' guardado correctamente.")