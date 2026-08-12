from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V38 para Intercultural Cursos de Idiomas...")
print("🔍 Set up: Inyectando 9 cursos de idiomas con link unificado y duración a consultar.\n")

# Extraído directamente de la radiografía del menú (dropdown)
carreras_intercultural = [
    {
        "id": 3801,
        "nombre_carrera": "Curso de Chino",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3802,
        "nombre_carrera": "Curso de Coreano",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3803,
        "nombre_carrera": "Curso de Francés",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3804,
        "nombre_carrera": "Curso de Inglés",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3805,
        "nombre_carrera": "Curso de Inglés Kids",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3806,
        "nombre_carrera": "Curso de Inglés Teens",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3807,
        "nombre_carrera": "Curso de Italiano",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3808,
        "nombre_carrera": "Curso de Japonés",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    },
    {
        "id": 3809,
        "nombre_carrera": "Curso de Portugués",
        "categoria": "Curso / Formación Profesional",
        "duracion": "Consultar en la web",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "Intercultural",
        "link_oficial": "https://intercultural.com.ar/"
    }
]

ies_data = {
    "id": 38,
    "nombre": "Intercultural Cursos de Idiomas",
    "nivel": "cursos",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@intercultural.com.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_intercultural
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "intercultural.json")
print(f"🎉 ¡Inyección perfecta! Se cargaron los {len(carreras_intercultural)} cursos de idiomas.")