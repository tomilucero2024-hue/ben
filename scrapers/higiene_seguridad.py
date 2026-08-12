from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual para Higiene y Seguridad...")
print("🔍 Set up: tecnicaturas de Higiene y Seguridad que se suman al catálogo de Educación Formal.")

# Estas carreras NO son oficios: son tecnicaturas y van al catálogo formal.
# unir_todo.py las fusiona por nombre: si la institución ya existe le agrega la
# carrera; si no existe (caso ITU), suma la institución entera.
# Se descartaron 4 carreras que ya figuraban en el catálogo (mismo nombre o mismo link).
higiene_seguridad = [
    {
        "id": 401,
        "nombre": "ITU - Instituto Tecnológico Universitario (UNCuyo)",
        "nivel": "universitario (pregrado)",
        "gestion": "pública",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Predio UNCUYO, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 40101,
                "nombre_carrera": "Técnico Universitario en Higiene y Seguridad en el Trabajo",
                "categoria": "Pregrado / Tecnicatura",
                "duracion": "3 años",
                "modalidad": "Presencial (lunes a viernes 18 a 23hs)",
                "facultad": "ITU-UNCuyo",
                "link_oficial": "https://itu.uncuyo.edu.ar/estudios/titulo/tecnico-universitario-en-higiene-y-seguridad-laboral"
            }
        ]
    },
    {
        "id": 406,
        "nombre": "INSUTEC (Instituto Superior de Educación Tecnológica)",
        "nivel": "terciario",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Mendoza"
        },
        "carreras": [
            {
                "id": 40601,
                "nombre_carrera": "Tecnicatura Superior en Higiene y Seguridad Laboral con Orientación en Calidad y Medio Ambiente",
                "categoria": "Pregrado / Tecnicatura",
                "duracion": "3 años",
                "modalidad": "Presencial",
                "facultad": "INSUTEC",
                "link_oficial": "https://expoeducativa.mendoza.edu.ar/carreras/767/tecnicatura-superior-en-higiene-y-seguridad-laboral-con-orientaci%C3%B3n-en-calidad-y-medio-ambiente"
            }
        ]
    }
]

guardar_json({"instituciones": higiene_seguridad}, "higiene_seguridad.json")
print(f"🎉 ¡Listo! Se cargaron {len(higiene_seguridad)} instituciones y "
      f"{sum(len(i['carreras']) for i in higiene_seguridad)} carreras de Higiene y Seguridad.")
