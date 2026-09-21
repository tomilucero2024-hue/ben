import json

from scraper_utils import guardar_json, DIR_DATOS


print("🛠️ Encendiendo inyección manual para Oficios Técnicos...")
print("🔍 Set up: oficios clásicos: electricidad, mecánica, soldadura, gas, refrigeración, herrería y peluquería.")

# Orden del catálogo: primero los presenciales en Mendoza (lo que pidió el
# usuario), y al final los 100% online. El orden de esta lista es el orden en que
# se muestran las tarjetas.
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
            "telefono": "261 429-5527",
            "email": "cct6015.educacional@gmail.com",
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
            },
            {
                "id": 30303,
                "nombre_carrera": "Mozos y Camareros / Ceremonial y Protocolo (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-015 Cecilia Grierson",
                "link_oficial": "https://www.elnueve.com/mendoza/cursos-gratuitos-en-mendoza-con-rapida-salida-laboral-donde-inscribirse-y-que-podes-estudiar_20260314/"
            },
            {
                "id": 30304,
                "nombre_carrera": "Información Turística y Atención al Cliente (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-015 Cecilia Grierson",
                "link_oficial": "https://www.elnueve.com/mendoza/cursos-gratuitos-en-mendoza-con-rapida-salida-laboral-donde-inscribirse-y-que-podes-estudiar_20260314/"
            },
            {
                "id": 30305,
                "nombre_carrera": "Vitrofusión (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-015 Cecilia Grierson",
                "link_oficial": "https://www.elnueve.com/mendoza/cursos-gratuitos-en-mendoza-con-rapida-salida-laboral-donde-inscribirse-y-que-podes-estudiar_20260314/"
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
        "id": 309,
        "nombre": "ITU - Instituto Tecnológico Universitario (UNCuyo)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (universidad)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "+54 261 405-4884",
            "email": "A confirmar",
            "direccion": "ITU Sede Luján, Alte. Brown 500, Chacras de Coria, Luján de Cuyo, Mendoza"
        },
        "carreras": [
            {
                "id": 30901,
                "nombre_carrera": "Operación de Autoelevadores (con credencial)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "1 jornada (10 horas)",
                "modalidad": "Presencial (simulador y equipo real)",
                "facultad": "ITU UNCuyo",
                "link_oficial": "https://itu.uncuyo.edu.ar/cursos/item/curso-de-operacion-de-autoelevadores"
            }
        ]
    },
    {
        "id": 310,
        "nombre": "IRAM Nuevo Cuyo",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada (organismo de normalización)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "+54 (261) 429-7343",
            "email": "cursosnuevocuyo@iram.org.ar",
            "direccion": "Av. Mitre 870, piso 10, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 31001,
                "nombre_carrera": "Seguridad en Equipos de Izaje - Operación de Autoelevadores",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "1 jornada",
                "modalidad": "Presencial (teórico + evaluación práctica)",
                "facultad": "IRAM Nuevo Cuyo",
                "link_oficial": "https://eventos.iram.org.ar/Home?id=2246"
            }
        ]
    },
    {
        "id": 311,
        "nombre": "Facultad de Filosofía y Letras - UNCuyo",
        "nivel": "capacitación (extensión universitaria)",
        "gestion": "pública",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "+54 261 413-5000",
            "email": "formacionpermanente@ffyl.uncu.edu.ar",
            "direccion": "Centro Universitario, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 31101,
                "nombre_carrera": "Topografía con Drones en Zonas de Montaña",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "1 semana (20 horas)",
                "modalidad": "Presencial",
                "facultad": "FFyL UNCuyo",
                "link_oficial": "https://ffyl.uncuyo.edu.ar/curso-topografia-con-drones-en-zonas-de-montana-procesamiento-y-produccion-de-mapas-topograficos-en-alta-resolucion"
            }
        ]
    },
    {
        "id": 312,
        "nombre": "Deacon - Peluqueras Caninas (Mendoza)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "261 590-7196 / 261 622-0445",
            "email": "A confirmar",
            "direccion": "Mendoza"
        },
        "carreras": [
            {
                "id": 31201,
                "nombre_carrera": "Peluquería Canina (teórico-práctico)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "8 meses (clases quincenales de 4 hs)",
                "modalidad": "Presencial",
                "facultad": "Deacon",
                "link_oficial": "https://deaconpelucanina.wixsite.com/deacon/capacitaciones"
            }
        ]
    },
    {
        "id": 314,
        "nombre": "Colegio de Agrimensura de Mendoza",
        "nivel": "capacitación profesional",
        "gestion": "privada (colegio profesional)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Mendoza"
        },
        "carreras": [
            {
                "id": 31401,
                "nombre_carrera": "Práctica Guiada: Instalación y Uso de OpenDroneMap",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "A confirmar",
                "facultad": "Colegio de Agrimensura de Mendoza",
                "link_oficial": "https://www.agrimensuramza.com/lo-que-formacion-continua-esta-preparando-aqui-los-cursos-que-se-vienen/"
            }
        ]
    },
    # --- Red DGE: Centros de Capacitación para el Trabajo (CCT), presenciales y gratuitos ---
    {
        "id": 316,
        "nombre": "CCT N° 6-202 (Ciudad de Mendoza)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "4-454078",
            "email": "dge6202@mendoza.edu.ar",
            "direccion": "A confirmar (Ciudad de Mendoza)"
        },
        "carreras": [
            {
                "id": 31601,
                "nombre_carrera": "Gasista 2° Categoría (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-202",
                "link_oficial": "https://cct6202.mendoza.edu.ar/cursoscortos/gasista-2-categoria/"
            },
            {
                "id": 31602,
                "nombre_carrera": "Cursos cortos de oficios (gratuitos)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-202",
                "link_oficial": "https://cct6202.mendoza.edu.ar/nuestros-cursos/"
            }
        ]
    },
    {
        "id": 317,
        "nombre": "CCT N° 6-017 \"Congreso de Tucumán\" (Dorrego, Guaymallén)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Joaquín V. González 427, Dorrego, Guaymallén, Mendoza"
        },
        "carreras": [
            {
                "id": 31701,
                "nombre_carrera": "Cocina y Gastronomía (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31702,
                "nombre_carrera": "Electricidad (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31703,
                "nombre_carrera": "Carpintería y Torneado/Ensamblado de Muebles de Madera (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31704,
                "nombre_carrera": "Peluquería (cortes y colorimetría) y Cosmetología (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31705,
                "nombre_carrera": "Marroquinería y Talabartería (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31706,
                "nombre_carrera": "Turismo e Inglés (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31707,
                "nombre_carrera": "Operador de PC y Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-017 Congreso de Tucumán",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            }
        ]
    },
    {
        "id": 318,
        "nombre": "CCT N° 6-057 (Rodeo de la Cruz, Guaymallén)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "261 200-7436 (solo mensajes)",
            "email": "cct6057sup@gmail.com",
            "direccion": "Chacabuco y Adolfo Calle, 4º Barrio COVIMET, Rodeo de la Cruz, Guaymallén, Mendoza"
        },
        "carreras": [
            {
                "id": 31801,
                "nombre_carrera": "Gasista Matriculado (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-057",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31802,
                "nombre_carrera": "Electricidad Domiciliaria (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-057",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31803,
                "nombre_carrera": "Gastronomía (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-057",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 31804,
                "nombre_carrera": "Operador de PC y Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-057",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            }
        ]
    },
    {
        "id": 319,
        "nombre": "CCT N° 6-046 \"Hilda Edith Moyano\" (San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Antártida Argentina 13, San Rafael, Mendoza (anexo: Jujuy 1435)"
        },
        "carreras": [
            {
                "id": 31901,
                "nombre_carrera": "Cocinero / Panadero / Pastelero (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-046 Hilda Edith Moyano",
                "link_oficial": "https://lv18.com.ar/abrieron-las-inscripciones-para-los-cursos-gratuitos-del-cct-6-046-hilda-edith-moyano/"
            },
            {
                "id": 31902,
                "nombre_carrera": "Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-046 Hilda Edith Moyano",
                "link_oficial": "https://lv18.com.ar/abrieron-las-inscripciones-para-los-cursos-gratuitos-del-cct-6-046-hilda-edith-moyano/"
            },
            {
                "id": 31903,
                "nombre_carrera": "Vitrofusión y Tapicería (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-046 Hilda Edith Moyano",
                "link_oficial": "https://lv18.com.ar/abrieron-las-inscripciones-para-los-cursos-gratuitos-del-cct-6-046-hilda-edith-moyano/"
            },
            {
                "id": 31904,
                "nombre_carrera": "Mozos/as, Información Turística y Ceremonial (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-046 Hilda Edith Moyano",
                "link_oficial": "https://lv18.com.ar/abrieron-las-inscripciones-para-los-cursos-gratuitos-del-cct-6-046-hilda-edith-moyano/"
            },
            {
                "id": 31905,
                "nombre_carrera": "Operador de PC y Secretariado (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-046 Hilda Edith Moyano",
                "link_oficial": "https://lv18.com.ar/abrieron-las-inscripciones-para-los-cursos-gratuitos-del-cct-6-046-hilda-edith-moyano/"
            }
        ]
    },
    {
        "id": 320,
        "nombre": "CCT N° 6-024 \"Angelina de Olaguer Feliú\" (San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Av. San Martín y Luzuriaga, San Rafael, Mendoza (anexo: 25 de Mayo y Santa Fe)"
        },
        "carreras": [
            {
                "id": 32001,
                "nombre_carrera": "Cocinero / Panadero / Pastelero (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-024 Olaguer Feliú",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32002,
                "nombre_carrera": "Textil: Operador de Máquinas y Modelista-Patronista (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-024 Olaguer Feliú",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32003,
                "nombre_carrera": "Fotografía, Cerámica y Vitrofusión (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-024 Olaguer Feliú",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32004,
                "nombre_carrera": "Tallado en Madera y Reciclado (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-024 Olaguer Feliú",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            }
        ]
    },
    {
        "id": 321,
        "nombre": "CCT N° 6-039 \"Guillermo Catalán\" (San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Av. Zapata 950, San Rafael, Mendoza"
        },
        "carreras": [
            {
                "id": 32101,
                "nombre_carrera": "Soldador (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-039 Guillermo Catalán",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32102,
                "nombre_carrera": "Mecánica del Automotor y Ciclomotor (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-039 Guillermo Catalán",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            }
        ]
    },
    {
        "id": 322,
        "nombre": "CCT N° 6-206 \"1 de Mayo\" (San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Av. Alberdi y Balcarce, San Rafael, Mendoza"
        },
        "carreras": [
            {
                "id": 32201,
                "nombre_carrera": "Electricidad (domiciliaria, muy baja tensión, montador e industrial) (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-206 1 de Mayo",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32202,
                "nombre_carrera": "Tornero y Soldador (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-206 1 de Mayo",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32203,
                "nombre_carrera": "Construcción en Seco, Gas Domiciliario e Instalaciones Sanitarias (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-206 1 de Mayo",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32204,
                "nombre_carrera": "Carpintería y Reparación de Heladeras y Aire Acondicionado (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-206 1 de Mayo",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            }
        ]
    },
    {
        "id": 323,
        "nombre": "CCT N° 6-042 (Villa Atuel, San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Sarmiento 55, Villa Atuel, San Rafael, Mendoza"
        },
        "carreras": [
            {
                "id": 32301,
                "nombre_carrera": "Soldador (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-042",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32302,
                "nombre_carrera": "Panadero y Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-042",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32303,
                "nombre_carrera": "Cosmetología, Carpintería e Inglés (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-042",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            }
        ]
    },
    {
        "id": 324,
        "nombre": "CCT N° 6-056 (Monte Comán, San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Lima s/n, Monte Comán, San Rafael, Mendoza"
        },
        "carreras": [
            {
                "id": 32401,
                "nombre_carrera": "Cocinero / Panadero / Pastelero (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-056",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32402,
                "nombre_carrera": "Soldador (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-056",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32403,
                "nombre_carrera": "Electricidad y Construcción (gas, sanitaria y en seco) (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-056",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32404,
                "nombre_carrera": "Mecánica del Ciclomotor (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-056",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            }
        ]
    },
    {
        "id": 325,
        "nombre": "CCT N° 6-502 \"Dra. Carmen Castellarnau\" (Real del Padre, San Rafael)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Misión Oeste 160, Real del Padre, San Rafael, Mendoza"
        },
        "carreras": [
            {
                "id": 32501,
                "nombre_carrera": "Cocinero y Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-502 Carmen Castellarnau",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32502,
                "nombre_carrera": "Montador Electricista Domiciliario (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-502 Carmen Castellarnau",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32503,
                "nombre_carrera": "Construcción en Seco, Gas Domiciliario y Soldador (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-502 Carmen Castellarnau",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            },
            {
                "id": 32504,
                "nombre_carrera": "Operador de PC (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "CCT N° 6-502 Carmen Castellarnau",
                "link_oficial": "https://hportal.mendoza.edu.ar/los-cct-de-san-rafael-cuentan-con-mas-de-30-propuestas-de-formacion-para-jovenes-y-adultos/"
            }
        ]
    },
    {
        "id": 326,
        "nombre": "DGE - Dirección de Técnica y Trabajo (CCT / DETyT)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (DGE)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "tecnicaytrabajo.cctfp@gmail.com",
            "direccion": "Av. San Martín 253, 2° piso, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 32601,
                "nombre_carrera": "Aprendé un oficio en los CCT (mapa y requisitos)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "Variable",
                "modalidad": "Presencial",
                "facultad": "DETyT - CCT Mendoza",
                "link_oficial": "https://www.mendoza.edu.ar/aprende-un-oficio-cct/"
            }
        ]
    },
    # --- Escuelas de Oficios municipales (presenciales, gratuitas) ---
    {
        "id": 327,
        "nombre": "Escuela de Oficios de Godoy Cruz",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (municipal)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "0800 800 6864",
            "email": "A confirmar",
            "direccion": "Colón 770, Godoy Cruz, Mendoza"
        },
        "carreras": [
            {
                "id": 32701,
                "nombre_carrera": "Soldadura General Básica (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Godoy Cruz",
                "link_oficial": "https://www.godoycruz.gob.ar/produccion-y-empleo/escuela-de-oficios/"
            },
            {
                "id": 32702,
                "nombre_carrera": "AutoCAD para Soldadura (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Godoy Cruz",
                "link_oficial": "https://www.godoycruz.gob.ar/produccion-y-empleo/escuela-de-oficios/"
            },
            {
                "id": 32703,
                "nombre_carrera": "Diseño de Indumentaria y Mundo Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Godoy Cruz",
                "link_oficial": "https://www.godoycruz.gob.ar/produccion-y-empleo/escuela-de-oficios/"
            },
            {
                "id": 32704,
                "nombre_carrera": "Ofimática Nivel 3 - Power BI (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Godoy Cruz",
                "link_oficial": "https://www.godoycruz.gob.ar/produccion-y-empleo/escuela-de-oficios/"
            }
        ]
    },
    {
        "id": 328,
        "nombre": "Escuela de Oficios de Maipú",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (municipal)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "261 716-6647",
            "email": "A confirmar",
            "direccion": "A confirmar (Maipú, Mendoza)"
        },
        "carreras": [
            {
                "id": 32801,
                "nombre_carrera": "Cocina (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Maipú",
                "link_oficial": "https://www.maipu.gob.ar/la-escuela-de-oficios-de-maipu-ya-tiene-sede-propia/"
            },
            {
                "id": 32802,
                "nombre_carrera": "Costura y Textil (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Maipú",
                "link_oficial": "https://www.maipu.gob.ar/la-escuela-de-oficios-de-maipu-ya-tiene-sede-propia/"
            },
            {
                "id": 32803,
                "nombre_carrera": "Reparación de Electrodomésticos (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Maipú",
                "link_oficial": "https://www.maipu.gob.ar/la-escuela-de-oficios-de-maipu-ya-tiene-sede-propia/"
            },
            {
                "id": 32804,
                "nombre_carrera": "Soldadura (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Maipú",
                "link_oficial": "https://www.maipu.gob.ar/la-escuela-de-oficios-de-maipu-ya-tiene-sede-propia/"
            },
            {
                "id": 32805,
                "nombre_carrera": "Electricidad Domiciliaria (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Maipú",
                "link_oficial": "https://www.maipu.gob.ar/la-escuela-de-oficios-de-maipu-ya-tiene-sede-propia/"
            },
            {
                "id": 32806,
                "nombre_carrera": "Reparación de Computadoras (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Maipú",
                "link_oficial": "https://www.maipu.gob.ar/la-escuela-de-oficios-de-maipu-ya-tiene-sede-propia/"
            }
        ]
    },
    {
        "id": 329,
        "nombre": "Escuela de Oficios de Guaymallén",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (municipal)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "261 200-7436 (solo mensajes)",
            "email": "A confirmar",
            "direccion": "A confirmar (Guaymallén, Mendoza)"
        },
        "carreras": [
            {
                "id": 32901,
                "nombre_carrera": "Gasista Matriculado (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Guaymallén",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 32902,
                "nombre_carrera": "Electricidad Domiciliaria (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Guaymallén",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 32903,
                "nombre_carrera": "Gastronomía (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Guaymallén",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            },
            {
                "id": 32904,
                "nombre_carrera": "Peluquería, Cosmetología y Marroquinería (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Escuela de Oficios de Guaymallén",
                "link_oficial": "https://www.guaymallen.gob.ar/centros-de-capacitacion-para-el-trabajo-en-guaymallen-inscripciones-abiertas/"
            }
        ]
    },
    {
        "id": 330,
        "nombre": "Municipalidad de Las Heras - Capacitación en Oficios (con UNCuyo)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (municipal + universidad)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "Las Heras centro y Uspallata, Mendoza"
        },
        "carreras": [
            {
                "id": 33001,
                "nombre_carrera": "Gasista Matriculado (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Municipalidad de Las Heras + UNCuyo",
                "link_oficial": "https://www.mendoza.gov.ar/prensa/produccion-la-uncuyo-y-la-municipalidad-de-las-heras-lanzan-importante-capacitacion-gratuita-en-oficios/"
            },
            {
                "id": 33002,
                "nombre_carrera": "Electromecánica (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Municipalidad de Las Heras + UNCuyo",
                "link_oficial": "https://www.mendoza.gov.ar/prensa/produccion-la-uncuyo-y-la-municipalidad-de-las-heras-lanzan-importante-capacitacion-gratuita-en-oficios/"
            },
            {
                "id": 33003,
                "nombre_carrera": "Inglés Turístico (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "A confirmar",
                "modalidad": "Presencial",
                "facultad": "Municipalidad de Las Heras + UNCuyo",
                "link_oficial": "https://www.mendoza.gov.ar/prensa/produccion-la-uncuyo-y-la-municipalidad-de-las-heras-lanzan-importante-capacitacion-gratuita-en-oficios/"
            }
        ]
    },
    {
        "id": 331,
        "nombre": "Municipalidad de San Rafael - Educación y Capacitación para el Trabajo",
        "nivel": "capacitación laboral / oficio",
        "gestion": "pública (municipal)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "A confirmar (San Rafael, Mendoza)"
        },
        "carreras": [
            {
                "id": 33101,
                "nombre_carrera": "Cursos de oficios (amplia oferta gratuita)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "Variable",
                "modalidad": "Presencial",
                "facultad": "Municipalidad de San Rafael",
                "link_oficial": "https://diariosanrafael.com.ar/inscripciones-abiertas-para-una-amplia-oferta-de-cursos-gratuitos-en-san-rafael/"
            }
        ]
    },
    {
        "id": 332,
        "nombre": "UTN Facultad Regional Mendoza - Extensión Universitaria",
        "nivel": "capacitación (extensión universitaria)",
        "gestion": "pública (universidad)",
        "provincia": "Mendoza",
        "contacto": {
            "telefono": "261 560-5639",
            "email": "capacitacion@frm.utn.edu.ar",
            "direccion": "Rodríguez 273, Ciudad de Mendoza"
        },
        "carreras": [
            {
                "id": 33201,
                "nombre_carrera": "Cursos de Extensión Universitaria (presenciales)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "Variable",
                "modalidad": "Presencial",
                "facultad": "UTN FRM",
                "link_oficial": "https://www4.frm.utn.edu.ar/category/extension/"
            }
        ]
    },
    {
        "id": 333,
        "nombre": "Fundación UOCRA - Centro de Formación Profesional (Construcción)",
        "nivel": "capacitación laboral / oficio",
        "gestion": "privada (fundación gremial)",
        "provincia": "A confirmar (sede Mendoza)",
        "contacto": {
            "telefono": "A confirmar",
            "email": "A confirmar",
            "direccion": "A confirmar"
        },
        "carreras": [
            {
                "id": 33301,
                "nombre_carrera": "Albañilería (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "3 a 4 meses",
                "modalidad": "Presencial",
                "facultad": "Fundación UOCRA",
                "link_oficial": "https://fundacion.uocra.org/oferta-educativa-cursos-de-formacion-profesional/"
            },
            {
                "id": 33302,
                "nombre_carrera": "Electricidad (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "3 a 4 meses",
                "modalidad": "Presencial",
                "facultad": "Fundación UOCRA",
                "link_oficial": "https://fundacion.uocra.org/oferta-educativa-cursos-de-formacion-profesional/"
            },
            {
                "id": 33303,
                "nombre_carrera": "Soldadura (gratuito)",
                "categoria": "Oficio / Formación Profesional",
                "duracion": "3 a 4 meses",
                "modalidad": "Presencial",
                "facultad": "Fundación UOCRA",
                "link_oficial": "https://fundacion.uocra.org/oferta-educativa-cursos-de-formacion-profesional/"
            }
        ]
    },
    # --- 100% online (van al final del catálogo) ---
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


# Guarda anti-pérdida: este script PISA data/oficios_tecnicos.json entero. Si la
# lista de acá quedó más corta que lo que ya estaba guardado, avisamos antes de
# escribir para no borrar instituciones sin darnos cuenta (igual que plataforma.py).
def avisar_perdidas(nuevas):
    ruta = DIR_DATOS / "oficios_tecnicos.json"
    if not ruta.exists():
        return
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            anteriores = json.load(f).get("instituciones", [])
    except (json.JSONDecodeError, OSError):
        return
    if len(anteriores) > len(nuevas):
        nombres_nuevos = {i.get("nombre") for i in nuevas}
        perdidas = [i.get("nombre") for i in anteriores if i.get("nombre") not in nombres_nuevos]
        print(f"⚠️ Ojo: el JSON tenía {len(anteriores)} instituciones y esta lista trae {len(nuevas)}.")
        if perdidas:
            print("   Se perderían: " + ", ".join(perdidas))
        print("   Revisá antes de seguir.")


avisar_perdidas(oficios_tecnicos)

guardar_json({"instituciones": oficios_tecnicos}, "oficios_tecnicos.json")
print(f"🎉 ¡Listo! Se cargaron {len(oficios_tecnicos)} instituciones y "
      f"{sum(len(i['carreras']) for i in oficios_tecnicos)} carreras de Oficios Técnicos.")
