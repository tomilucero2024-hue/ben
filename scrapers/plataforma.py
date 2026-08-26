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