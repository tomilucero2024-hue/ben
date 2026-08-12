from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual V33 para el IES 9-029 (Luján de Cuyo)...")
print("🔍 Set up: Inyectando 5 Tecnicaturas (3 años) y 3 Profesorados (4 años) desde las capturas.\n")

# Extraído de las radiografías del código HTML
carreras_ies9029 = [
    {
        "id": 3301,
        "nombre_carrera": "Tecnicatura Superior en Conservación de la Naturaleza",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/tecnicaturas/conservacion%20naturaleza/"
    },
    {
        "id": 3302,
        "nombre_carrera": "Tecnicatura Superior en Enología",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/tecnicaturas/enologia/"
    },
    {
        "id": 3303,
        "nombre_carrera": "Tecnicatura Superior en Turismo",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/tecnicaturas/turismo/"
    },
    {
        "id": 3304,
        "nombre_carrera": "Tecnicatura Superior en Higiene y Ambiente",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/tecnicaturas/higiene%20ambiente/"
    },
    {
        "id": 3305,
        "nombre_carrera": "Tecnicatura Superior en Recursos Humanos",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/tecnicaturas/recursos%20humanos/"
    },
    {
        "id": 3306,
        "nombre_carrera": "Profesorado de Geografía",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/profesorados/geografia/"
    },
    {
        "id": 3307,
        "nombre_carrera": "Profesorado de Educación Primaria",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/profesorados/primaria/"
    },
    {
        "id": 3308,
        "nombre_carrera": "Profesorado para Técnicos",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-029",
        "link_oficial": "https://www.ies9029.edu.ar/inicio/formacion/carreras/profesorados/tecnicos/"
    }
]

ies_data = {
    "id": 33,
    "nombre": "IES 9-029 (Luján de Cuyo)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@ies9029.edu.ar",
        "direccion": "Luján de Cuyo, Mendoza"
    },
    "carreras": carreras_ies9029
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "ies9029.json")
print(f"🎉 ¡Carburador a fondo! Se inyectaron las {len(carreras_ies9029)} carreras del IES 9-029 impecables.")