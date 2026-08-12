from urllib.parse import urljoin

from scraper_utils import guardar_json, pedir_sopa


print("🛠️ Rectificando escáner V43 para la Escuela de Psicología Social...")
print("🔍 Set up: Escaneo profundo de todas las carreras disponibles.\n")

url_base = "https://espsicosocial.com.ar/"

ies_data = {
    "id": 43,
    "nombre": "Escuela de Psicología Social",
    "nivel": "terciario",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@espsicosocial.com.ar",
        "direccion": "Mendoza"
    },
    "carreras": []
}

carreras_procesadas = set()

try:
    print(f"📍 Mapeando sitio: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos enlaces que parezcan carreras (suelen tener 'tecnicatura' o 'acompanamiento' en el link)
    enlaces = sopa.find_all('a', href=True)
    
    for a in enlaces:
        link = a['href']
        if "tecnicatura" in link.lower() or "acompanamiento" in link.lower():
            link_completo = urljoin(url_base, link)
            
            if link_completo in carreras_procesadas:
                continue
            carreras_procesadas.add(link_completo)
            
            # --- Limpiamos el nombre para el JSON ---
            nombre_slug = link.strip('/').split('/')[-1]
            nombre = nombre_slug.replace('-', ' ').title()
            
            # Asignamos duración según el tipo
            if "acompanamiento" in nombre.lower():
                duracion = "2 años y 1/2"
            else:
                duracion = "3 años"
                
            print(f"  🔍 Carrera detectada: {nombre} ({duracion})")
            
            ies_data["carreras"].append({
                "id": 4300 + len(ies_data["carreras"]),
                "nombre_carrera": nombre,
                "categoria": "Pregrado / Tecnicatura",
                "duracion": duracion,
                "modalidad": "A confirmar",
                "turno": "A confirmar",
                "facultad": "Escuela de Psicología Social",
                "link_oficial": link_completo
            })

    # Guardamos el resultado limpio
    base_ies = {"instituciones": [ies_data]}
    guardar_json(base_ies, "psicosocial.json")
    print(f"\n✅ ¡Escaneo finalizado! Se cargaron {len(ies_data['carreras'])} carreras en el archivo.")

except Exception as e:
    print(f"⚠️ Falla mecánica en el escaneo: {e}")