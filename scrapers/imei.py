from scraper_utils import guardar_json


print("🛠️ Rectificando inyección V40 para el IMEI...")
print("🔌 Puenteando todos los links al sitio oficial principal.\n")

url_principal = "https://maipu-infd.mendoza.edu.ar/sitio/"

carreras_imei = [
    {
        "id": 4001,
        "nombre_carrera": "Profesorado en Educación Primaria",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Maipú de Educación Integral",
        "link_oficial": url_principal
    },
    {
        "id": 4002,
        "nombre_carrera": "Profesorado en Educación Inicial",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Maipú de Educación Integral",
        "link_oficial": url_principal
    },
    {
        "id": 4003,
        "nombre_carrera": "Profesorado en Inglés",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Maipú de Educación Integral",
        "link_oficial": url_principal
    },
    {
        "id": 4004,
        "nombre_carrera": "Profesorado en Historia",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Maipú de Educación Integral",
        "link_oficial": url_principal
    },
    {
        "id": 4005,
        "nombre_carrera": "Tecnicatura Superior en Administración de Empresas y Microemprendimientos",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Maipú de Educación Integral",
        "link_oficial": url_principal
    },
    {
        "id": 4006,
        "nombre_carrera": "Tecnicatura Superior en Turismo y Hotelería",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Instituto Maipú de Educación Integral",
        "link_oficial": url_principal
    }
]

ies_data = {
    "id": 40,
    "nombre": "Instituto Maipú de Educación Integral (IMEI)",
    "nivel": "terciario",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@imei.edu.ar",
        "direccion": "Maipú, Mendoza"
    },
    "carreras": carreras_imei
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "imei.json")
print("🎉 ¡Listo el pollo! Links unificados a la página principal del IMEI.")