from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V26 para la Escuela de Cine (IES 9-017)...")
print("🔍 Set up: Motor monocilíndrico. Una sola carrera, cortita y al pie.\n")

carreras_cine = [
    {
        "id": 2601,
        "nombre_carrera": "Técnico Superior en Cine, Video y Televisión",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Escuela de Cine (IES 9-017)",
        "link_oficial": "https://escueladecine9017-infd.mendoza.edu.ar/sitio/catalogo/plan-de-estudio/"
    }
]

ies_data = {
    "id": 26,
    "nombre": "Escuela Regional Cuyo de Cine y Video (IES 9-017)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@escueladecine9017.edu.ar",
        "direccion": "Mendoza" 
    },
    "carreras": carreras_cine
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "ies9017.json")
print("🎉 ¡Listo el pollo! Se inyectó la única carrera de la Escuela de Cine.")