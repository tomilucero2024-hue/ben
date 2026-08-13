import json
import os
import subprocess
import sys
from pathlib import Path

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


# Los 45 bloques que antes estaban copiados uno por uno (uno por institución)
# ahora viven aca, como tuplas (archivo_json, mensaje_ok, mensaje_falta),
# respetando el ORDEN original. La función cargar_simples() hace por cada uno
# exactamente lo que hacia su bloque: chequear existencia, abrir, sumar las
# "instituciones" y avisar con el mensaje correspondiente.
ARCHIVOS_SIMPLES = [
    ("utn.json", "✅ Datos de la UTN cargados al chasis.", "⚠️ Faltan los datos de la UTN. Corré scraper_utn.py primero."),
    ("uncuyo.json", "✅ Datos de la UNCuyo cargados al chasis.", "⚠️ Faltan los datos de la UNCuyo. Corré scraper_uncuyo.py primero."),
    ("um.json", "✅ Datos de la UM cargados al chasis.", "⚠️ Faltan los datos de la UM. Corré scraper_um.py primero."),
    ("umaza.json", "✅ Datos de la UMaza cargados al chasis.", "⚠️ Faltan los datos de la UMaza. Corré scraper_umaza.py primero."),
    ("ucongreso.json", "✅ Datos de la U. de Congreso cargados al chasis.", "⚠️ Faltan los datos de la U. de Congreso. Corré scraper_ucongreso.py primero."),
    ("uda.json", "✅ Datos de la UDA cargados al chasis.", "⚠️ Faltan los datos de la UDA. Corré scraper_uda.py primero."),
    ("uch.json", "✅ Datos de la U. Champagnat cargados al chasis.", "⚠️ Faltan los datos de la U. Champagnat. Corré scraper_uch.py primero."),
    ("uca.json", "✅ Datos de la UCA cargados al chasis.", "⚠️ Faltan los datos de la UCA. Corré scraper_uca.py primero."),
    ("iuce.json", "✅ Datos del IUCE cargados al chasis.", "⚠️ Faltan los datos del IUCE. Corré scraper_iuce.py primero."),
    ("s21.json", "✅ Datos de la Siglo 21 cargados al chasis.", "⚠️ Faltan los datos de la Siglo 21. Corré scraper_s21.py primero."),
    ("ies9001.json", "✅ Datos del IES 9-001 cargados al chasis.", "⚠️ Faltan los datos del IES 9-001. Corré scraper_ies_9001.py primero."),
    ("ies_godoycruz.json", "✅ Datos del IES Tomás Godoy Cruz cargados al chasis.", "⚠️ Faltan los datos del IES Tomás Godoy Cruz. Corré scraper_ies_godoycruz.py primero."),
    ("ies9003.json", "✅ Datos del IES 9-003 (San Rafael) cargados al chasis.", "⚠️ Faltan los datos del IES 9-003. Corré scraper_ies_9003.py primero."),
    ("ies9004.json", "✅ Datos del IES 9-004 (Tunuyán) cargados al chasis.", "⚠️ Faltan los datos del IES 9-004. Corré scraper_ies_9004.py primero."),
    ("ies9005.json", "✅ Datos del IES 9-005 cargados al chasis.", "⚠️ Faltan los datos del IES 9-005. Corré scraper_ies_9005.py primero."),
    ("ies9006.json", "✅ Datos del IES 9-006 (Rivadavia) cargados al chasis.", "⚠️ Faltan los datos del IES 9-006. Corré scraper_ies_9006.py primero."),
    ("ies9008.json", "✅ Datos del IES 9-008 cargados al chasis.", "⚠️ Faltan los datos del IES 9-008. Corré scraper_ies_9008.py primero."),
    ("ies9009.json", "✅ Datos del IES 9-009 (Tupungato) cargados al chasis.", "⚠️ Faltan los datos del IES 9-009. Corré scraper_ies_9009.py primero."),
    ("ies9010.json", "✅ Datos del IES 9-010 (San Carlos) cargados al chasis.", "⚠️ Faltan los datos del IES 9-010. Corré scraper_ies_9010.py primero."),
    ("ies9011.json", "✅ Datos del IES 9-011 (San Rafael) cargados al chasis.", "⚠️ Faltan los datos del IES 9-011. Corré scraper_ies_9011.py primero."),
    ("ies9012.json", "✅ Datos del IES 9-012 (Informática) cargados al chasis.", "⚠️ Faltan los datos del IES 9-012. Corré scraper_ies_9012.py primero."),
    ("ies9013.json", "✅ Datos del ISTEEC (IES 9-013) cargados al chasis.", "⚠️ Faltan los datos del ISTEEC. Corré scraper_ies_9013.py primero."),
    ("ies9014.json", "✅ Datos del IES 9-014 (Profesorado de Arte) cargados al chasis.", "⚠️ Faltan los datos del IES 9-014. Corré scraper_ies_9014.py primero."),
    ("ies9015.json", "✅ Datos del IESVU (IES 9-015) cargados al chasis.", "⚠️ Faltan los datos del IESVU. Corré scraper_ies_9015.py primero."),
    ("ies9016.json", "✅ Datos del IEF (IES 9-016) cargados al chasis.", "⚠️ Faltan los datos del IEF. Corré scraper_ies_9016.py primero."),
    ("ies9017.json", "✅ Datos de la Escuela de Cine (IES 9-017) cargados al chasis.", "⚠️ Faltan los datos del IES 9-017. Corré scraper_ies_9017.py primero."),
    ("ies9018.json", "✅ Datos del IES 9-018 (Malargüe) cargados al chasis.", "⚠️ Faltan los datos del IES 9-018. Corré scraper_ies_9018.py primero."),
    ("insutec.json", "✅ Datos de INSUTEC cargados al chasis.", "⚠️ Faltan los datos de INSUTEC. Corré scraper_insutec.py primero."),
    ("ies9021.json", "✅ Datos del IES 9-021 cargados al chasis.", "⚠️ Faltan los datos del IES 9-021. Corré scraper_ies_9021.py primero."),
    ("ies9023.json", "✅ Datos del IES 9-023 cargados al chasis.", "⚠️ Faltan los datos del IES 9-023. Corré scraper_ies_9023.py primero."),
    ("ies9024.json", "✅ Datos del IES 9-024 (Lavalle) cargados al chasis.", "⚠️ Faltan los datos del IES 9-024. Corré scraper_ies_9024.py primero."),
    ("ies9028.json", "✅ Datos del IES 9-028 (Santa Rosa) cargados al chasis.", "⚠️ Faltan los datos del IES 9-028. Corré scraper_ies_9028.py primero."),
    ("ies9029.json", "✅ Datos del IES 9-029 (Luján de Cuyo) cargados al chasis.", "⚠️ Faltan los datos del IES 9-029. Corré scraper_ies_9029.py primero."),
    ("ies9030.json", "✅ Datos del IES 9-030 (Bicentenario) cargados al chasis.", "⚠️ Faltan los datos del IES 9-030. Corré scraper_ies_9030.py primero."),
    ("fabian_calle.json", "✅ Datos del Instituto Fabián Calle cargados al chasis.", "⚠️ Faltan los datos del Fabián Calle. Corré scraper_fabian_calle.py primero."),
    ("gutenberg.json", "✅ Datos del Instituto Gutenberg cargados al chasis.", "⚠️ Faltan los datos del Gutenberg. Corré scraper_gutenberg.py primero."),
    ("rayuela.json", "✅ Datos de Fundación Rayuela cargados al chasis.", "⚠️ Faltan los datos de Rayuela. Corré scraper_rayuela.py primero."),
    ("intercultural.json", "✅ Datos de Intercultural cargados al chasis.", "⚠️ Faltan los datos de Intercultural. Corré scraper_intercultural.py primero."),
    ("chopin.json", "✅ Datos del Instituto de Arte Chopin cargados al chasis.", "⚠️ Faltan los datos de Chopin. Corré scraper_chopin.py primero."),
    ("imei.json", "✅ Datos del Instituto IMEI cargados al chasis.", "⚠️ Faltan los datos del IMEI. Corré scraper_imei.py primero."),
    ("trinidad.json", "✅ Datos del Instituto Santísima Trinidad cargados al chasis.", "⚠️ Faltan los datos del Santísima Trinidad. Corré scraper_trinidad.py primero."),
    ("epd.json", "✅ Datos de la EPD cargados al chasis.", "⚠️ Faltan los datos de la EPD. Corré scraper_epd.py primero."),
    ("psicosocial.json", "✅ Datos de la Escuela de Psicología Social cargados al chasis.", "⚠️ Faltan los datos de Psicología Social. Corré scraper_psicosocial.py primero."),
    ("malvinas.json", "✅ Datos del Instituto cargados al chasis.", "⚠️ Faltan los datos del archivo. Corré el script correspondiente primero."),
    ("insrp.json", "✅ Datos del Instituto cargados al chasis.", "⚠️ Faltan los datos del instituto. Corré scraper_insrp.py primero."),
]


def cargar_simples(instituciones):
    for archivo, mensaje_ok, mensaje_falta in ARCHIVOS_SIMPLES:
        if os.path.exists(DIR_DATOS / archivo):
            with open(DIR_DATOS / archivo, "r", encoding="utf-8") as f:
                datos = json.load(f)
                instituciones.extend(datos.get("instituciones", []))
            print(mensaje_ok)
        else:
            print(mensaje_falta)


# Higiene y Seguridad: son tecnicaturas, no oficios, así que van al catálogo formal.
# Si la institución ya está cargada se le agregan las carreras (para no duplicarla);
# si no está, se suma entera.
def cargar_higiene(instituciones):
    if os.path.exists(DIR_DATOS / "higiene_seguridad.json"):
        with open(DIR_DATOS / "higiene_seguridad.json", "r", encoding="utf-8") as f:
            datos = json.load(f)
        por_nombre = {i.get("nombre"): i for i in instituciones}
        for nueva in datos.get("instituciones", []):
            existente = por_nombre.get(nueva.get("nombre"))
            if existente:
                existente.setdefault("carreras", []).extend(nueva.get("carreras", []))
                print(f"✅ Higiene y Seguridad: {len(nueva.get('carreras', []))} carrera(s) sumadas a '{nueva['nombre']}'.")
            else:
                instituciones.append(nueva)
                print(f"✅ Higiene y Seguridad: '{nueva['nombre']}' agregada como institución nueva.")
    else:
        print("⚠️ Falta higiene_seguridad.json. Corré scrapers/higiene_seguridad.py primero.")


# Grupos que NO se mezclan con "instituciones": van como claves propias en la raíz
# del data.json, al mismo nivel que "instituciones" y "plataformas".
GRUPOS_APARTE = {
    "formaciones_alternativas": "formaciones_alternativas.json",
    "oficios_tecnicos": "oficios_tecnicos.json",
    "secundario": "secundario.json",
}


def cargar_grupos_aparte():
    grupos_aparte = {}
    for clave, archivo in GRUPOS_APARTE.items():
        if os.path.exists(DIR_DATOS / archivo):
            with open(DIR_DATOS / archivo, "r", encoding="utf-8") as f:
                datos = json.load(f)
            grupos_aparte[clave] = datos.get("instituciones", [])
            print(f"✅ {clave}: {len(grupos_aparte[clave])} instituciones cargadas aparte.")
        else:
            grupos_aparte[clave] = []
            print(f"⚠️ Falta {archivo}. Corré scrapers/{clave}.py primero.")
    return grupos_aparte


# Unificamos todo en el data.json maestro y encadenamos la inyección de
# plataformas online para que data.json nunca quede sin la sección "plataformas".
def guardar_y_plataformas(instituciones, grupos_aparte):
    base_final = {"instituciones": instituciones, **grupos_aparte}
    guardar_json(base_final, "data.json")
    print("\n🎉 ¡Listo el pollo! Archivo 'data.json' maestro generado con las tres universidades adentro.")

    print("\n🔌 Inyectando plataformas online...")
    subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "plataforma.py")], check=True)


def main():
    print("🛠️ Ensamblando el motor V12 completo (UTN + UNCuyo + UM)...\n")
    instituciones = []
    cargar_simples(instituciones)
    cargar_higiene(instituciones)
    grupos_aparte = cargar_grupos_aparte()
    guardar_y_plataformas(instituciones, grupos_aparte)


if __name__ == "__main__":
    main()
