from urllib.parse import unquote

from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Rectificando escáner V34 para el IES 9-030 (Instituto del Bicentenario)...")
print("🔍 Plan B: Extrayendo nombres directamente desde las URLs (modo bulldozer).\n")

carreras_viejas = carreras_guardadas("ies9030.json")
ies_data = {
    "id": 34,
    "nombre": "IES 9-030 (Instituto del Bicentenario)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@institutodelbicentenario.edu.ar",
        "direccion": "Godoy Cruz, Mendoza"
    },
    "carreras": []
}

url_base = "https://institutodelbicentenario-infd.mendoza.edu.ar/sitio/"
id_global = 3400
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Conectando el escáner por fuerza bruta a: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos TODOS los links de la página
    enlaces = sopa.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        
        if not link_oficial:
            continue
            
        # Si el link tiene la palabra profesorado o tecnicatura, lo cazamos
        if "profesorado-" in link_oficial.lower() or "tecnicatura-" in link_oficial.lower():
            
            # Limpiamos basuritas de WordPress (links de comentarios, respuestas, etc.)
            if "#" in link_oficial or "replytocom" in link_oficial:
                continue
                
            if link_oficial in carreras_procesadas:
                continue
            carreras_procesadas.add(link_oficial)
            
            # --- MAGIA MECÁNICA: Armamos el nombre desde la URL ---
            slug = link_oficial.strip('/').split('/')[-1] # Agarramos la última parte del link
            slug = unquote(slug) # Le sacamos caracteres raros de internet
            nombre_carrera = slug.replace('-', ' ').title() # Cambiamos guiones por espacios
            
            # Chapa y pintura fina para preposiciones
            for palabra in [' De ', ' En ', ' Y ', ' Para ', ' La ', ' El ', ' Con ', ' A ']:
                nombre_carrera = nombre_carrera.replace(palabra, palabra.lower())
            
            if nombre_carrera in carreras_viejas:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera}")
            else:
                if "profesorado" in nombre_carrera.lower():
                    categoria = "Grado / Profesorado"
                    duracion = "4 años"
                else:
                    categoria = "Pregrado / Tecnicatura"
                    duracion = "3 años"
                    
                print(f"  🔍 Carrera detectada (vía URL): {nombre_carrera} ({duracion})")
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria,
                    "duracion": duracion,
                    "modalidad": "Presencial",
                    "turno": "A confirmar",
                    "facultad": "IES 9-030",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Ahora sí! Se sacaron {contador} carreras chupando directamente de los links.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-030: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9030.json")
print("🎉 Archivo 'ies9030.json' guardado correctamente.")