from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V32 para el IES 9-028 (Santa Rosa)...")
print("🔍 Set up: Inyectando las 4 carreras de la captura (Profesorados 4 años, Tecnicaturas 3 años).\n")

# Datos extraídos directo de la radiografía del menú HTML
carreras_ies9028 = [
    {
        "id": 3201,
        "nombre_carrera": "Profesorado en Educación Primaria",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-028",
        "link_oficial": "https://ies9028-infd.mendoza.edu.ar/sitio/profesorado-en-educacion-primaria/"
    },
    {
        "id": 3202,
        "nombre_carrera": "Profesorado de Teatro",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-028",
        "link_oficial": "https://ies9028-infd.mendoza.edu.ar/sitio/profesorado-de-teatro/"
    },
    {
        "id": 3203,
        "nombre_carrera": "Profesorado en Música",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-028",
        "link_oficial": "https://ies9028-infd.mendoza.edu.ar/sitio/profesorado-de-musica/"
    },
    {
        "id": 3204,
        "nombre_carrera": "Tecnicatura Superior en Enología e Industrias de los Alimentos",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-028",
        "link_oficial": "https://ies9028-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-industria-de-los-alimentos/"
    }
]

ies_data = {
    "id": 32,
    "nombre": "IES 9-028 (Santa Rosa)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@ies9028.edu.ar",
        "direccion": "Santa Rosa, Mendoza"
    },
    "carreras": carreras_ies9028
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "ies9028.json")
print(f"🎉 ¡Inyección perfecta! Se cargaron las {len(carreras_ies9028)} carreras del IES 9-028.")