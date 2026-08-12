from scraper_utils import guardar_json


print("🛠️ Rectificando con los repuestos originales para INSUTEC...")
print("🧹 Cargando las 6 tecnicaturas oficiales que marcaste en la foto.\n")

carreras_insutec = [
    {
        "id": 2801,
        "nombre_carrera": "Tecnicatura Superior en Minería",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "INSUTEC",
        "link_oficial": "https://www.insutec.edu.ar/"
    },
    {
        "id": 2802,
        "nombre_carrera": "Tecnicatura Superior en Petróleo y Gas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "INSUTEC",
        "link_oficial": "https://www.insutec.edu.ar/"
    },
    {
        "id": 2803,
        "nombre_carrera": "Tecnicatura Superior en Construcciones Sustentables",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "INSUTEC",
        "link_oficial": "https://www.insutec.edu.ar/"
    },
    {
        "id": 2804,
        "nombre_carrera": "Tecnicatura Superior en Metalmecánica",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "INSUTEC",
        "link_oficial": "https://www.insutec.edu.ar/"
    },
    {
        "id": 2805,
        "nombre_carrera": "Tecnicatura Superior en Energías Renovables",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "INSUTEC",
        "link_oficial": "https://www.insutec.edu.ar/"
    },
    {
        "id": 2806,
        "nombre_carrera": "Tecnicatura Superior en Higiene, Seguridad y Ambiente",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "INSUTEC",
        "link_oficial": "https://www.insutec.edu.ar/"
    }
]

ies_data = {
    "id": 28,
    "nombre": "INSUTEC (Instituto Superior de Educación Tecnológica)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@insutec.edu.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_insutec
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "insutec.json")
print(f"🎉 ¡Ahora sí, motor armado con piezas originales! Se inyectaron las {len(carreras_insutec)} carreras correctas de INSUTEC.")