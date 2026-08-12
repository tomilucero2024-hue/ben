from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V21 para IES 9-012 (Informática San Rafael)...")
print("🔍 Set up: Filtrando especializaciones, inyectando solo las 5 tecnicaturas principales.\n")

# Extraído de la radiografía de código (Atributo 'title' de la foto)
carreras_ies9012 = [
    {
        "id": 2101,
        "nombre_carrera": "Tecnicatura Superior en Desarrollo de Software",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-012 (San Rafael)",
        "link_oficial": "https://ies9012.edu.ar/sigeaweb/index.php/oferta-academica/tecnicatura-superior-en-desarrollo-de-software"
    },
    {
        "id": 2102,
        "nombre_carrera": "Tecnicatura Superior en Gestión de Recursos Humanos",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-012 (San Rafael)",
        "link_oficial": "https://ies9012.edu.ar/sigeaweb/index.php/oferta-academica/tecnicatura-superior-en-gestion-de-recursos-humanos"
    },
    {
        "id": 2103,
        "nombre_carrera": "Tecnicatura Superior en Higiene, Seguridad y Ambiente",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-012 (San Rafael)",
        "link_oficial": "https://ies9012.edu.ar/sigeaweb/index.php/oferta-academica/tecnicatura-superior-en-higiene-seguridad-y-ambiente"
    },
    {
        "id": 2104,
        "nombre_carrera": "Tecnicatura Superior en Logística",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-012 (San Rafael)",
        "link_oficial": "https://ies9012.edu.ar/sigeaweb/index.php/oferta-academica/tecnicatura-superior-en-logistica"
    },
    {
        "id": 2105,
        "nombre_carrera": "Tecnicatura Superior en Redes y Ciberseguridad",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-012 (San Rafael)",
        "link_oficial": "https://ies9012.edu.ar/sigeaweb/index.php/oferta-academica/tecnicatura-superior-en-redes-y-ciberseguridad"
    }
]

ies_data = {
    "id": 21,
    "nombre": "IES 9-012 Informática",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0260-4422262", # Teléfono de contacto genérico de San Rafael
        "email": "contacto@ies9012.edu.ar",
        "direccion": "Paunero 1124, San Rafael, Mendoza"
    },
    "carreras": carreras_ies9012
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "ies9012.json")
print(f"🎉 ¡Fierro caliente! Se inyectaron {len(carreras_ies9012)} tecnicaturas del IES 9-012 en el archivo JSON.")