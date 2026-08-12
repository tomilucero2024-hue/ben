from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V47 para Cultural Mendoza...")
print("🔍 Set up: Inyectando el curso de inglés presencial para todas las edades.\n")

carreras_cultural = [
    {
        "id": 4701,
        "nombre_carrera": "Curso de Inglés para Todas las Edades",
        "categoria": "Curso / Formación Profesional",
        "duracion": "A confirmar",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Cultural Mendoza",
        "link_oficial": "https://culturalmendoza.com/ensenanza-de-ingles/"
    }
]

ies_data = {
    "id": 47,
    "nombre": "Cultural Mendoza",
    "nivel": "cursos",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@culturalmendoza.com",
        "direccion": "Mendoza"
    },
    "carreras": carreras_cultural
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "cultural_mendoza.json")
print("🎉 ¡Inyección perfecta! Se cargó el curso de inglés en el chasis.")