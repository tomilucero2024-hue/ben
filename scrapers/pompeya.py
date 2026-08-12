from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V46...")
print("🔍 Set up: Inyectando el Profesorado y la Tecnicatura desde la radiografía.\n")

carreras_insrp = [
    {
        "id": 4601,
        "nombre_carrera": "Profesorado en Educación Primaria",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Superior",
        "link_oficial": "https://insrp-infd.mendoza.edu.ar/sitio/profesorado-de-educacion-primaria/"
    },
    {
        "id": 4602,
        "nombre_carrera": "Tecnicatura Superior en Asistencia Gerontológica",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Superior",
        "link_oficial": "https://insrp-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-asistencia-gerontologica/"
    }
]

ies_data = {
    "id": 46,
    "nombre": "Instituto Superior",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@insrp-infd.mendoza.edu.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_insrp
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "insrp.json")
print("🎉 ¡Inyección perfecta! Se cargaron las 2 carreras del instituto.")