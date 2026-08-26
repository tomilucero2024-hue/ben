from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual para la Universidad de la Defensa Nacional (UNDEF)...")
print("🔍 Set up: Inyectando las 9 carreras a distancia con enlace oficial.\n")

carreras_undef = [
    {
        "id": 1,
        "nombre_carrera": "Tecnicatura Universitaria en Desarrollo de Aplicaciones Informáticas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 2,
        "nombre_carrera": "Tecnicatura en Higiene y Seguridad en el Trabajo",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ingeniería del Ejército",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 3,
        "nombre_carrera": "Licenciatura en Relaciones Internacionales",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad del Ejército",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 4,
        "nombre_carrera": "Contador Público",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 5,
        "nombre_carrera": "Licenciatura en Administración",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 6,
        "nombre_carrera": "Licenciatura en Logística",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 7,
        "nombre_carrera": "Licenciatura en Recursos Humanos",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años y medio",
        "modalidad": "A Distancia",
        "facultad": "Facultad de Ciencias de la Administración - CRUC IUA",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 8,
        "nombre_carrera": "Licenciatura en Ciberdefensa",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad de la Defensa Nacional",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    },
    {
        "id": 9,
        "nombre_carrera": "Licenciatura en Gestión Pública",
        "categoria": "Grado / Licenciatura",
        "duracion": "4 años",
        "modalidad": "A Distancia",
        "facultad": "Facultad de la Defensa Nacional",
        "link_oficial": "https://undef.edu.ar/a-distancia-2/"
    }
]

undef_data = {
    "id": 47,
    "nombre": "Universidad de la Defensa Nacional (UNDEF)",
    "nivel": "universidad",
    "gestion": "pública",
    "provincia": "Nacional (a distancia)",
    "contacto": {
        "telefono": "",
        "email": "informes@iua.edu.ar",
        "direccion": "Modalidad a distancia - Sede central Córdoba"
    },
    "carreras": carreras_undef
}

base_undef = {"instituciones": [undef_data]}

guardar_json(base_undef, "undef.json")
print("🎉 ¡Inyección perfecta! Se cargaron las 9 carreras de la UNDEF en el chasis.")
