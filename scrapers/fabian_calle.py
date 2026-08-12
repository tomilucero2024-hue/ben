from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V35 para el Instituto Fabián Calle...")
print("🔍 Set up: Motor de un solo cilindro (Carrera única, gestión privada).\n")

carreras_fabian_calle = [
    {
        "id": 3501,
        "nombre_carrera": "Técnico Superior en Locución de Radio y Televisión",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Fabián Calle",
        "link_oficial": "https://institutocalle.edu.ar/oferta-educativa/locucion/"
    }
]

ies_data = {
    "id": 35,
    "nombre": "Instituto Fabián Calle",
    "nivel": "terciario",
    "gestion": "privada", # ¡Acá cambiamos la caja de cambios a Privada!
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@institutocalle.edu.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_fabian_calle
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "fabian_calle.json")
print("🎉 ¡Arranque perfecto! Se inyectó la carrera de Locución del Fabián Calle.")