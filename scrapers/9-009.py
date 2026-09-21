from scraper_utils import guardar_json


print("🛠️ Inyectando la flota completa del IES 9-009 (Tupungato) por bypass manual...")

carreras_ies9009 = [
    {
        "id": 1801,
        "nombre_carrera": "Tecnicatura Superior en Energías Renovables",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicarura-superior-en-energias-renovables/"
    },
    {
        "id": 1802,
        "nombre_carrera": "Tecnicatura Superior en Enología e Industrias Frutihortícolas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-enologia-e-industrias-frutihorticolas/"
    },
    {
        "id": 1803,
        "nombre_carrera": "Tecnicatura Superior Agronómica (Sede Central)",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-agronomia/"
    },
    {
        "id": 1804,
        "nombre_carrera": "Tecnicatura Superior Agronómica (Sede Agrelo)",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-agronomia/"
    },
    {
        "id": 1805,
        "nombre_carrera": "Tecnicatura Superior en Petróleo y Gas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-petroleo-y-gas/"
    },
    {
        "id": 1806,
        "nombre_carrera": "Tecnicatura Superior en Diseño Multimedial",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-diseno-multimedial/"
    },
    {
        "id": 1807,
        "nombre_carrera": "Tecnicatura Superior en Administración de Empresas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "A Distancia",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-administracion-de-empresas-distancia/"
    },
    {
        "id": 1808,
        "nombre_carrera": "Tecnicatura Superior en Administración Pública (A Distancia)",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "A Distancia",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-administracion-publica-a-distancia/"
    },
    {
        "id": 1809,
        "nombre_carrera": "Tecnicatura Superior en Administración Pública (INFOPE)",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-administracion-publica-con-orientacion-en-gestion-penitenciaria/"
    },
    {
        "id": 1810,
        "nombre_carrera": "Tecnicatura Superior en Administración Pública (Legislatura)",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-administracion-publica-con-orientacion-en-instituciones-legislativas/"
    },
    {
        "id": 1811,
        "nombre_carrera": "Tecnicatura Superior en Logística",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-logistica-2/"
    },
    {
        "id": 1812,
        "nombre_carrera": "Profesorado de Educación Especial",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/profesorado-de-educacion-especial/"
    },
    {
        "id": 1813,
        "nombre_carrera": "Profesorado de Educación Primaria",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/profesorado-de-educacion-primaria/"
    },
    {
        "id": 1814,
        "nombre_carrera": "Profesorado de Educación Secundaria en Química",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/profesorado-de-quimica/"
    },
    {
        "id": 1815,
        "nombre_carrera": "Profesorado de Educación Secundaria en Matemática",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/profesorado-de-matematica/"
    },
    {
        "id": 1816,
        "nombre_carrera": "Tecnicatura en Diseño Gráfico",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-diseno-grafico/"
    },
    {
        "id": 1817,
        "nombre_carrera": "Tecnicatura Superior en Turismo",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-superior-en-turismo-2/"
    },
    {
        "id": 1818,
        "nombre_carrera": "Tecnicatura en Guía de Turismo",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-guia-de-turismo/"
    },
    {
        "id": 1819,
        "nombre_carrera": "Tecnicatura en Gestión de Alojamientos Turísticos",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "2 años",
        "modalidad": "Presencial",
        "turno": "A confirmar",
        "facultad": "IES 9-009",
        "link_oficial": "https://ies9009-infd.mendoza.edu.ar/sitio/tecnicatura-en-gestion-de-alojamientos-turisticos/"
    }
]

ies_data = {
    "id": 18,
    "nombre": "IES 9-009 (Tupungato)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "02622-488820", # Rescatado de la data oficial
        "email": "ens9009@infd.edu.ar",
        "direccion": "Secundino Gómez y Dr. Mathons, Tupungato"
    },
    "carreras": carreras_ies9009
}

base_ies = {"instituciones": [ies_data]}

guardar_json(base_ies, "ies9009.json")
print(f"🎉 ¡Fierro caliente! Se cargaron las {len(carreras_ies9009)} carreras del IES 9-009 en el archivo JSON.")