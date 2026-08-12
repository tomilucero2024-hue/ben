from scraper_utils import guardar_json


print("🛠️ Rectificando inyección manual V37 para Fundación Rayuela...")
print("🔍 Set up: Inyectando las 6 carreras completas leídas de los links de las capturas.\n")

carreras_rayuela = [
    {
        "id": 3701,
        "nombre_carrera": "Profesorado de Educación Especial",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Fundación Rayuela",
        "link_oficial": "https://fundacionrayuela.org.ar/sitio/profesor-especial/"
    },
    {
        "id": 3702,
        "nombre_carrera": "Tecnicatura Superior en Bibliotecología",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Fundación Rayuela",
        "link_oficial": "https://fundacionrayuela.org.ar/sitio/bibliotecario/"
    },
    {
        "id": 3703,
        "nombre_carrera": "Tecnicatura Superior en Acompañamiento Terapéutico",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Fundación Rayuela",
        "link_oficial": "https://fundacionrayuela.org.ar/sitio/acompanante-terapeutico/"
    },
    {
        "id": 3704,
        "nombre_carrera": "Tecnicatura en Preceptoría Escolar",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 Años y medio",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Fundación Rayuela",
        "link_oficial": "https://fundacionrayuela.org.ar/sitio/preceptor/"
    },
    {
        "id": 3705,
        "nombre_carrera": "Profesorado de Educación Inicial",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Fundación Rayuela",
        "link_oficial": "https://fundacionrayuela.org.ar/sitio/profesor-inicial/"
    },
    {
        "id": 3706,
        "nombre_carrera": "Profesorado de Educación Primaria",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Fundación Rayuela",
        "link_oficial": "https://fundacionrayuela.org.ar/sitio/profesor-primaria/"
    }
]

ies_data = {
    "id": 37,
    "nombre": "Fundación Rayuela",
    "nivel": "terciario",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@fundacionrayuela.org.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_rayuela
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "rayuela.json")
print("🎉 ¡Motor rectificado! Se cargaron las 6 carreras completas de Fundación Rayuela.")