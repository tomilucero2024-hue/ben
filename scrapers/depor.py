from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V42 para la Escuela de Periodismo Deportivo (EPD)...")
print("🔍 Set up: Inyectando la carrera de Periodismo Deportivo.\n")

carreras_epd = [
    {
        "id": 4201,
        "nombre_carrera": "Tecnicatura Superior en Periodismo Deportivo",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Escuela de Periodismo Deportivo de Mendoza",
        "link_oficial": "https://epdmendoza.com.ar/"
    }
]

ies_data = {
    "id": 42,
    "nombre": "Escuela de Periodismo Deportivo de Mendoza (EPD)",
    "nivel": "terciario",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@epdmendoza.com.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_epd
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "epd.json")
print("🎉 ¡Inyección perfecta! Se cargó Periodismo Deportivo en el chasis.")