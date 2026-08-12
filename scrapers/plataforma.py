import json
import os
from pathlib import Path

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
    }
]

archivo_maestro = DIR_DATOS / "data.json"

# 2. Abrimos tu chasis actual (el data.json que ya tiene las facultades)
if os.path.exists(archivo_maestro):
    try:
        with open(archivo_maestro, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        
        # 3. Le inyectamos la pestaña nueva de plataformas (como agregarle GNC al baúl)
        datos['plataformas'] = plataformas_online

        # 4. Guardamos todo ensamblado en el mismo archivo
        with open(archivo_maestro, 'w', encoding='utf-8') as f:
            json.dump(datos, f, indent=4, ensure_ascii=False)

        print("✅ ¡Corta la bocha! Plataformas inyectadas correctamente en data.json.")
        
    except json.JSONDecodeError:
        print("⚠️ Epa, el data.json está roto o mal armado. Revisalo.")
else:
    print(f"⚠️ ¡Pará la moto! No encuentro el archivo '{archivo_maestro}'. Asegurate de correr este script en la misma carpeta donde está la página web.")