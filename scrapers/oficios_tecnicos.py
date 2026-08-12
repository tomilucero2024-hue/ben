from scraper_utils import guardar_json


print("🛠️ Encendiendo inyección manual para Oficios Técnicos...")
print("🔍 Set up: oficios clásicos: electricidad, mecánica, soldadura, gas, refrigeración, herrería y peluquería.")

oficios_tecnicos = [
    {
        "id": 301,
        "nombre": "Escuelas Newton (Sede Mendoza)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "(0261) 420-46xx",
            "email": "A confirmar",
            "direccion": "Entre Ríos 158, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 30101,
                "nombre_carrera": "Montador Electricista Domiciliario - Electricista Industrial",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "12 meses",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/montador-electricista-domiciliario-electricista-industrial/"
            },
            {
                "id": 30102,
                "nombre_carrera": "Mecánica Automotriz",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/mecanica-automotriz/"
            },
            {
                "id": 30103,
                "nombre_carrera": "Mecánica, Electricidad y Electrónica de Motos",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/mecanica-electricidad-y-electronica-de-motos/"
            },
            {
                "id": 30104,
                "nombre_carrera": "Soldadura en Aluminio (TIG)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/soldadura-en-aluminio/"
            },
            {
                "id": 30105,
                "nombre_carrera": "Soldadura Alta Presión Combinado",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/soldadura-alta-presion-combinado/"
            },
            {
                "id": 30106,
                "nombre_carrera": "Procesos Metalúrgicos y de Soldadura en General",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/procesos-metalurgicos-y-de-soldadura-en-general/"
            },
            {
                "id": 30107,
                "nombre_carrera": "Instalación de Gas (Instalador de Gas - Matrícula ECOGAS 2ª Categoría)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/servicios/instalacion-de-gas/"
            },
            {
                "id": 30108,
                "nombre_carrera": "Refrigeración y Aire Acondicionado",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/refrigeracion-y-aire-acondicionado/"
            },
            {
                "id": 30109,
                "nombre_carrera": "Carpintería en Madera",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/"
            },
            {
                "id": 30110,
                "nombre_carrera": "Electrónica",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuelas Newton",
                "link_oficial": "https://escuelasnewton.com.ar/tecnica/"
            }
        ]
    },
    {
        "id": 302,
        "nombre": "Universidad de Congreso - Programa de Capacitación Laboral",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada (extensión universitaria)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "0261 4230630",
            "email": "A confirmar",
            "direccion": "Colón 90, Mendoza"
        },
        "carreras": [
            {
                "id": 30201,
                "nombre_carrera": "Electricista Domiciliario (hasta 3,7kW)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "8 clases (sábados de 9 a 12hs)",
                "modalidad": "Presencial",
                "facultad": "Universidad de Congreso",
                "link_oficial": "https://www.ucongreso.edu.ar/curso-de-electricista-domiciliario/"
            }
        ]
    },
    {
        "id": 303,
        "nombre": "Centro de Capacitación para el Trabajo N° 6-015 \"Cecilia Grierson\"",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Salta 1149, planta baja, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 30301,
                "nombre_carrera": "Montador Electricista Domiciliario (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-015 Cecilia Grierson",
                "link_oficial": "https://www.elnueve.com/mendoza/cursos-gratuitos-en-mendoza-con-rapida-salida-laboral-donde-inscribirse-y-que-podes-estudiar_20260314/"
            },
            {
                "id": 30302,
                "nombre_carrera": "Cocinero / Panadero / Pastelero (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-015 Cecilia Grierson",
                "link_oficial": "https://www.elnueve.com/mendoza/cursos-gratuitos-en-mendoza-con-rapida-salida-laboral-donde-inscribirse-y-que-podes-estudiar_20260314/"
            }
        ]
    },
    {
        "id": 304,
        "nombre": "Instituto Tesla",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "A confirmar",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "A confirmar"
        },
        "carreras": [
            {
                "id": 30401,
                "nombre_carrera": "Gasista Matriculado Categoría 3",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "A confirmar",
                "facultad": "Instituto Tesla",
                "link_oficial": "https://institutotesla.ar/cursos/gasista-matriculado-cat-3/"
            }
        ]
    },
    {
        "id": 305,
        "nombre": "Cursos Técnicos y Oficios (con certificación Cámara Argentina de Refrigeración - Sede Mendoza)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "A confirmar"
        },
        "carreras": [
            {
                "id": 30501,
                "nombre_carrera": "Instalador de Aire Acondicionado y Refrigeración Frío-Calor Sistema Inverter",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Cursos Técnicos y Oficios",
                "link_oficial": "https://www.cursostecnicosyoficios.org/"
            },
            {
                "id": 30502,
                "nombre_carrera": "Reparación de Electrodomésticos (certificación Cámara Argentina de Refrigeración)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Cursos Técnicos y Oficios",
                "link_oficial": "https://www.cursostecnicosyoficios.org/"
            }
        ]
    },
    {
        "id": 306,
        "nombre": "IAP - Instituto Estilismo, Estética y Belleza (Sedes Mendoza)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "IAP Libertador Gral. San Martín y IAP Maipú, Mendoza"
        },
        "carreras": [
            {
                "id": 30601,
                "nombre_carrera": "Barbería / Barber Shop",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "2 a 4 meses (32-64 horas)",
                "modalidad": "Presencial / Online / Dual",
                "facultad": "IAP",
                "link_oficial": "https://institutosiap.com/peluqueria_belleza/cursos-online/curso/72/curso-de-barberia-o-barber-shop/iap-libertador-gral-san-martin-mendoza-on-line-dir-reartes-sandra-rebeca"
            }
        ]
    },
    {
        "id": 307,
        "nombre": "ISE Cursos - Educación a Distancia (Oficios)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "A confirmar (online, accesible desde Mendoza)",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Online"
        },
        "carreras": [
            {
                "id": 30701,
                "nombre_carrera": "Gasista e Instalaciones Sanitarias + IA",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A ritmo propio",
                "modalidad": "Online",
                "facultad": "ISE Cursos",
                "link_oficial": "https://www.isecursos.com/detalle-67"
            },
            {
                "id": 30702,
                "nombre_carrera": "Técnico Auxiliar en Refrigeración y Aire Acondicionado + IA",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A ritmo propio",
                "modalidad": "Online",
                "facultad": "ISE Cursos",
                "link_oficial": "https://www.isecursos.com/detalle-53"
            },
            {
                "id": 30703,
                "nombre_carrera": "Herrería Artística + IA",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A ritmo propio",
                "modalidad": "Online",
                "facultad": "ISE Cursos",
                "link_oficial": "https://www.isecursos.com/detalle-2668"
            },
            {
                "id": 30704,
                "nombre_carrera": "Restauración Artesanal de Muebles + IA",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A ritmo propio",
                "modalidad": "Online",
                "facultad": "ISE Cursos",
                "link_oficial": "https://www.isecursos.com/detalle-741"
            }
        ]
    },
    {
        "id": 308,
        "nombre": "Euroinnova / Zowa Vet (Herrería de Caballos - Online)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "A confirmar (online, accesible desde Mendoza)",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Online"
        },
        "carreras": [
            {
                "id": 30801,
                "nombre_carrera": "Herrador de Caballos y Podólogo Equino",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "300 horas",
                "modalidad": "Online",
                "facultad": "Euroinnova / Zowa Vet",
                "link_oficial": "https://zowaeducation.com/cursos/zowa-vet/curso-herrador-caballos-podologo/"
            }
        ]
    }
]

guardar_json({"instituciones": oficios_tecnicos}, "oficios_tecnicos.json")
print(f"🎉 ¡Listo! Se cargaron {len(oficios_tecnicos)} instituciones y "
      f"{sum(len(i['carreras']) for i in oficios_tecnicos)} carreras de Oficios Técnicos.")
