from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V23 para IES 9-014 (Profesorado de Arte - IPA)...")
print("🔍 Set up: Inyectando las carreras oficiales (Prof. 4 años, Tec. 3 años).\n")

# Extraído directito de tu radiografía del menú HTML
carreras_ipa = [
    {
        "id": 2301,
        "nombre_carrera": "Profesorado de Danzas",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-014 Profesorado de Arte (IPA)",
        "link_oficial": "https://profesoradodearte.edu.ar/danzas/"
    },
    {
        "id": 2302,
        "nombre_carrera": "Profesorado de Música",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-014 Profesorado de Arte (IPA)",
        "link_oficial": "https://profesoradodearte.edu.ar/musica/"
    },
    {
        "id": 2303,
        "nombre_carrera": "Profesorado de Teatro",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-014 Profesorado de Arte (IPA)",
        "link_oficial": "https://profesoradodearte.edu.ar/teatro/"
    },
    {
        "id": 2304,
        "nombre_carrera": "Profesorado de Artes Visuales",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-014 Profesorado de Arte (IPA)",
        "link_oficial": "https://profesoradodearte.edu.ar/artes-visuales/"
    },
    {
        "id": 2305,
        "nombre_carrera": "Tecnicatura en Gestión Cultural y Economía de la Cultura",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-014 Profesorado de Arte (IPA)",
        "link_oficial": "https://profesoradodearte.edu.ar/tecnicatura/"
    },
    {
        "id": 2306,
        "nombre_carrera": "Profesorado para Técnicos",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-014 Profesorado de Arte (IPA)",
        "link_oficial": "https://profesoradodearte.edu.ar/profesorado-para-tecnicos/"
    }
]

ies_data = {
    "id": 23,
    "nombre": "IES 9-014 Profesorado de Arte (IPA)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@profesoradodearte.edu.ar",
        "direccion": "San Rafael, Mendoza" 
    },
    "carreras": carreras_ipa
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "ies9014.json")
print(f"🎉 ¡Carburador a fondo! Se inyectaron {len(carreras_ipa)} carreras del IPA.")