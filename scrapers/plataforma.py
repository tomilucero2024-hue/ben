import json
import os
import sys
from pathlib import Path

# Los mensajes de abajo usan emojis y la consola de Windows arranca en cp1252:
# sin esto el script muere con UnicodeEncodeError DESPUÉS de escribir el JSON y
# devuelve código 1, cortando el encadenado desde unir_todo.py.
for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    except (AttributeError, OSError):
        pass

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("Arrancando inyección de plataformas...")

# 1. Acá tenemos el repuesto nuevo: la lista de plataformas online
plataformas_online = [
    {
        "institucion": "Coderhouse",
        "modalidad": "100% Online en vivo",
        "oferta": "Cursos cortos y carreras (Programación, Data, Diseño, Marketing)",
        "duracion": "De 2 a 6 meses"
    },
    {
        "institucion": "Soy Henry",
        "modalidad": "100% Online (Full-time o Part-time)",
        "oferta": "Bootcamp intensivo (Full Stack Developer, Data Science)",
        "duracion": "4 meses (Full-time) a 8 meses (Part-time)"
    },
    {
        "institucion": "Educación IT",
        "modalidad": "Online en vivo y a tu ritmo",
        "oferta": "Cursos ultra específicos y carreras cortas de tecnología",
        "duracion": "Variable (desde días hasta pocos meses)"
    },
    {
        "institucion": "Digital House",
        "modalidad": "100% Online",
        "oferta": "Programación, Data Analytics, Marketing",
        "duracion": "De 5 a 7 meses"
    },
    {
        "institucion": "Nucba",
        "modalidad": "100% Online",
        "oferta": "Bootcamp de Desarrollo Web y Diseño",
        "duracion": "De 4 a 6 meses"
    },
    {
        "institucion": "Mindhub",
        "modalidad": "100% Online",
        "oferta": "Bootcamp inmersivo (Full Stack Web y Mobile)",
        "duracion": "Aproximadamente 4 meses"
    },
    {
        "institucion": "Image Campus",
        "modalidad": "Online y presencial / Híbrida",
        "oferta": "Desarrollo de Videojuegos, Animación, Arte 3D y Programación",
        "duracion": "Trayectos cortos o carreras terciarias de 3 años"
    },
    {
        "institucion": "Escuela Da Vinci",
        "modalidad": "Online y presencial / Híbrida",
        "oferta": "Diseño Multimedial, Sistemas, Videojuegos",
        "duracion": "Cursos cortos y carreras terciarias de 3 años"
    },
    {
        "institucion": "Teclab",
        "modalidad": "100% Online",
        "oferta": "Tecnicaturas superiores co-creadas con empresas (Programación, Cloud, Data)",
        "duracion": "2 años"
    },
    # Plataformas de acceso libre: se entra y se empieza cuando uno quiera, sin
    # convocatoria ni cupo por selección. El frontend ya las conoce en
    # PLATAFORMAS_INFO (frontend/app.js); si faltan acá, unir_todo.py las borra.
    {
        "institucion": "Fundación YPF",
        "modalidad": "100% Online (en vivo o autoasistido)",
        "oferta": "IA, Data Analytics, Programación, Ciberseguridad, Excel, Power BI",
        "duracion": "De 3 hs a 3 meses según curso"
    },
    {
        "institucion": "Santander Open Academy",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Python, IA, inglés de negocios, emprendimiento, habilidades digitales",
        "duracion": "Variable, sin límite de cursos"
    },
    {
        "institucion": "ProgramON",
        "modalidad": "100% Online, autoguiado",
        "oferta": "Programación, habilidades blandas, armado de CV, LinkedIn",
        "duracion": "Corta, a tu ritmo"
    },
    {
        "institucion": "Microsoft Learn",
        "modalidad": "100% Online, autoasistido",
        "oferta": "Azure, IA, ciberseguridad, análisis de datos, certificaciones oficiales",
        "duracion": "Variable según ruta de aprendizaje"
    },
    {
        "institucion": "Enlace 2.0 (Gobierno de Mendoza)",
        "modalidad": "100% Online, autogestionado",
        "oferta": "Alfabetización digital, marketing, trabajos rurales, atención al público, drones",
        "duracion": "Variable según curso"
    },
    # --- Plataformas nacionales / LatAm ---
    {
        "institucion": "Platzi",
        "modalidad": "100% Online, a tu ritmo (suscripción)",
        "oferta": "Programación, IA, Data, Diseño, Marketing e Inglés",
        "duracion": "Variable (rutas de aprendizaje)"
    },
    {
        "institucion": "Domestika",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Creatividad: ilustración, diseño, fotografía, IA y artesanía",
        "duracion": "Cursos de pocas semanas"
    },
    {
        "institucion": "Crehana",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Diseño, marketing, negocios, audiovisual y fotografía",
        "duracion": "Cursos y academias (rutas)"
    },
    {
        "institucion": "Open English",
        "modalidad": "100% Online en vivo (clases 24/7)",
        "oferta": "Inglés con profesores nativos y preparación TOEFL/IELTS/TOEIC",
        "duracion": "Según nivel"
    },
    {
        "institucion": "Capacitarte",
        "modalidad": "100% Online",
        "oferta": "Cursos cortos y carreras en administración, salud, tecnología y oficios",
        "duracion": "De semanas a 2 años"
    },
    {
        "institucion": "Centro de e-Learning UTN BA",
        "modalidad": "100% Online (en vivo o autogestionado)",
        "oferta": "Cursos, diplomaturas y carreras con certificado oficial UTN",
        "duracion": "De semanas a 3 años"
    },
    {
        "institucion": "Google Actívate (Crece con Google)",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Marketing digital, datos, IA, programación y empleabilidad",
        "duracion": "Cursos cortos y certificados (3 a 6 meses)"
    },
    {
        "institucion": "Fundación Telefónica - Conecta Empleo",
        "modalidad": "100% Online, autogestionado",
        "oferta": "Programación, marketing digital, analítica web y habilidades digitales",
        "duracion": "Cursos cortos"
    },
    # --- Plataformas internacionales gratuitas (con certificado) ---
    {
        "institucion": "Coursera",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Cursos y certificados de universidades y empresas (Google, IBM, Meta)",
        "duracion": "De semanas a meses"
    },
    {
        "institucion": "edX",
        "modalidad": "100% Online, a tu ritmo (auditoría gratuita)",
        "oferta": "Cursos de Harvard, MIT y otras universidades; MicroMasters",
        "duracion": "De semanas a meses"
    },
    {
        "institucion": "freeCodeCamp",
        "modalidad": "100% Online, autoguiado y gratuito",
        "oferta": "Programación web, Python, data y ciberseguridad; certificaciones gratuitas",
        "duracion": "A tu ritmo (100% gratis)"
    },
    {
        "institucion": "Khan Academy (español)",
        "modalidad": "100% Online, autoguiado y gratuito",
        "oferta": "Matemática, ciencias, programación y preparación académica",
        "duracion": "A tu ritmo (100% gratis)"
    },
    {
        "institucion": "IBM SkillsBuild",
        "modalidad": "100% Online, autoguiado y gratuito",
        "oferta": "IA, ciberseguridad, datos y habilidades profesionales; certificados IBM",
        "duracion": "Cursos cortos (100% gratis)"
    },
    {
        "institucion": "Cisco Networking Academy",
        "modalidad": "100% Online, autoguiado y gratuito",
        "oferta": "Redes, ciberseguridad, Python e IoT; certificaciones Cisco",
        "duracion": "Cursos cortos (100% gratis)"
    },
    {
        "institucion": "AWS Skill Builder",
        "modalidad": "100% Online, autoasistido",
        "oferta": "Cloud, IA y data con rutas de preparación para certificaciones AWS",
        "duracion": "Variable según ruta"
    },
    {
        "institucion": "Google Cloud Skills Boost",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Google Cloud, IA y data; skill badges y certificaciones",
        "duracion": "Variable según ruta"
    },
    {
        "institucion": "MIT OpenCourseWare",
        "modalidad": "100% Online, autoguiado y gratuito",
        "oferta": "Cursos universitarios del MIT (ciencias, ingeniería y computación)",
        "duracion": "A tu ritmo (100% gratis)"
    },
    {
        "institucion": "OpenLearn (Open University)",
        "modalidad": "100% Online, autoguiado y gratuito",
        "oferta": "Cursos universitarios del Reino Unido en múltiples áreas",
        "duracion": "De horas a semanas (100% gratis)"
    },
    # --- Plataformas internacionales de pago ---
    {
        "institucion": "Udemy",
        "modalidad": "100% Online, a tu ritmo (compra por curso)",
        "oferta": "Más de 200.000 cursos de todas las áreas",
        "duracion": "A tu ritmo (acceso de por vida)"
    },
    {
        "institucion": "Udacity",
        "modalidad": "100% Online, a tu ritmo (suscripción)",
        "oferta": "Nanodegrees de IA, data y cloud con proyectos revisados",
        "duracion": "De 3 a 6 meses"
    },
    {
        "institucion": "FutureLearn",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Cursos y microcredenciales de universidades del Reino Unido",
        "duracion": "De semanas a meses"
    },
    {
        "institucion": "Codecademy",
        "modalidad": "100% Online, interactivo",
        "oferta": "Programación, data y ciberseguridad con práctica en el navegador",
        "duracion": "A tu ritmo (suscripción)"
    },
    {
        "institucion": "DataCamp",
        "modalidad": "100% Online, interactivo",
        "oferta": "Data science, Python, R, SQL y analítica",
        "duracion": "A tu ritmo (suscripción)"
    },
    {
        "institucion": "LinkedIn Learning",
        "modalidad": "100% Online, a tu ritmo",
        "oferta": "Tecnología, negocios y habilidades blandas con certificados",
        "duracion": "Cursos cortos (suscripción)"
    }
]

archivo_maestro = DIR_DATOS / "data.json"

# 2. Abrimos tu chasis actual (el data.json que ya tiene las facultades)
if os.path.exists(archivo_maestro):
    try:
        with open(archivo_maestro, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        
        # 3. Le inyectamos la pestaña nueva de plataformas (como agregarle GNC al baúl)
        # Antes avisamos si la lista de acá quedó corta respecto de lo que ya
        # estaba guardado: este script PISA la clave entera, así que una lista
        # desactualizada borra plataformas sin dejar rastro (ya pasó una vez).
        anteriores = datos.get('plataformas', [])
        if len(anteriores) > len(plataformas_online):
            nombres_nuevos = {p['institucion'] for p in plataformas_online}
            perdidas = [p.get('institucion') for p in anteriores
                        if p.get('institucion') not in nombres_nuevos]
            print(f"⚠️ ¡Ojo! data.json tenía {len(anteriores)} plataformas y esta lista trae {len(plataformas_online)}.")
            if perdidas:
                print("   Se perderían: " + ", ".join(perdidas))
            print("   Agregalas a 'plataformas_online' en este archivo antes de seguir.")

        datos['plataformas'] = plataformas_online

        # 4. Guardamos todo ensamblado en el mismo archivo
        with open(archivo_maestro, 'w', encoding='utf-8') as f:
            json.dump(datos, f, indent=4, ensure_ascii=False)

        print("✅ ¡Corta la bocha! Plataformas inyectadas correctamente en data.json.")
        
    except json.JSONDecodeError:
        print("⚠️ Epa, el data.json está roto o mal armado. Revisalo.")
else:
    print(f"⚠️ ¡Pará la moto! No encuentro el archivo '{archivo_maestro}'. Asegurate de correr este script en la misma carpeta donde está la página web.")