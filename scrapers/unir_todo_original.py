import json
import os
import subprocess
import sys
from pathlib import Path

from scraper_utils import guardar_json

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Ensamblando el motor V12 completo (UTN + UNCuyo + UM)...\n")

instituciones = []

# 1. Sumamos la UTN
if os.path.exists(DIR_DATOS / "utn.json"):
    with open(DIR_DATOS / "utn.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la UTN cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la UTN. Corré scraper_utn.py primero.")

# 2. Sumamos la UNCuyo
if os.path.exists(DIR_DATOS / "uncuyo.json"):
    with open(DIR_DATOS / "uncuyo.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la UNCuyo cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la UNCuyo. Corré scraper_uncuyo.py primero.")

# 3. Sumamos la Universidad de Mendoza (UM)
if os.path.exists(DIR_DATOS / "um.json"):
    with open(DIR_DATOS / "um.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la UM cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la UM. Corré scraper_um.py primero.")
# ... (acá arriba está lo de la UTN, UNCuyo y UM) ...

# 4. Sumamos la UMaza
if os.path.exists(DIR_DATOS / "umaza.json"):
    with open(DIR_DATOS / "umaza.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la UMaza cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la UMaza. Corré scraper_umaza.py primero.")
# ... (UTN, UNCuyo, UM, UMaza) ...

# 5. Sumamos la Universidad de Congreso (UC)
if os.path.exists(DIR_DATOS / "ucongreso.json"):
    with open(DIR_DATOS / "ucongreso.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la U. de Congreso cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la U. de Congreso. Corré scraper_ucongreso.py primero.")
# ... (acá arriba están las otras 5 universidades) ...

# 6. Sumamos la Universidad del Aconcagua (UDA)
if os.path.exists(DIR_DATOS / "uda.json"):
    with open(DIR_DATOS / "uda.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la UDA cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la UDA. Corré scraper_uda.py primero.")
# ... (arriba tenés las otras 6 universidades) ...

# 7. Sumamos la Universidad Champagnat (UCh)
if os.path.exists(DIR_DATOS / "uch.json"):
    with open(DIR_DATOS / "uch.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la U. Champagnat cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la U. Champagnat. Corré scraper_uch.py primero.")
# ... (arriba tenés las otras 7 universidades) ...

# 8. Sumamos la UCA
if os.path.exists(DIR_DATOS / "uca.json"):
    with open(DIR_DATOS / "uca.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la UCA cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la UCA. Corré scraper_uca.py primero.")

# 9. Sumamos el IUCE
if os.path.exists(DIR_DATOS / "iuce.json"):
    with open(DIR_DATOS / "iuce.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IUCE cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IUCE. Corré scraper_iuce.py primero.")
# ... (arriba tenés las 9 universidades anteriores) ...

# 10. Sumamos la Siglo 21 (S21)
if os.path.exists(DIR_DATOS / "s21.json"):
    with open(DIR_DATOS / "s21.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la Siglo 21 cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la Siglo 21. Corré scraper_s21.py primero.")
# 11. Sumamos el IES 9-001 San Martín
if os.path.exists(DIR_DATOS / "ies9001.json"):
    with open(DIR_DATOS / "ies9001.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-001 cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-001. Corré scraper_ies_9001.py primero.")
# 12. Sumamos el IES Tomás Godoy Cruz
if os.path.exists(DIR_DATOS / "ies_godoycruz.json"):
    with open(DIR_DATOS / "ies_godoycruz.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES Tomás Godoy Cruz cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES Tomás Godoy Cruz. Corré scraper_ies_godoycruz.py primero.")

# 13. Sumamos el IES 9-003 Normal (San Rafael)
if os.path.exists(DIR_DATOS / "ies9003.json"):
    with open(DIR_DATOS / "ies9003.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-003 (San Rafael) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-003. Corré scraper_ies_9003.py primero.")

# 14. Sumamos el IES 9-004 Toribio de Luzuriaga (Tunuyán)
if os.path.exists(DIR_DATOS / "ies9004.json"):
    with open(DIR_DATOS / "ies9004.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-004 (Tunuyán) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-004. Corré scraper_ies_9004.py primero.")

# 15. Sumamos el IES 9-005
if os.path.exists(DIR_DATOS / "ies9005.json"):
    with open(DIR_DATOS / "ies9005.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-005 cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-005. Corré scraper_ies_9005.py primero.")

# 16. Sumamos el IES 9-006 Francisco H. Tolosa (Rivadavia)
if os.path.exists(DIR_DATOS / "ies9006.json"):
    with open(DIR_DATOS / "ies9006.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-006 (Rivadavia) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-006. Corré scraper_ies_9006.py primero.")

# 17. Sumamos el IES 9-008 Manuel Belgrano
if os.path.exists(DIR_DATOS / "ies9008.json"):
    with open(DIR_DATOS / "ies9008.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-008 cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-008. Corré scraper_ies_9008.py primero.")

# 18. Sumamos el IES 9-009 (Tupungato)
if os.path.exists(DIR_DATOS / "ies9009.json"):
    with open(DIR_DATOS / "ies9009.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-009 (Tupungato) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-009. Corré scraper_ies_9009.py primero.")

# 19. Sumamos el IES 9-010 Rosario Vera Peñaloza (San Carlos)
if os.path.exists(DIR_DATOS / "ies9010.json"):
    with open(DIR_DATOS / "ies9010.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-010 (San Carlos) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-010. Corré scraper_ies_9010.py primero.")

# 20. Sumamos el IES 9-011 Del Atuel (San Rafael)
if os.path.exists(DIR_DATOS / "ies9011.json"):
    with open(DIR_DATOS / "ies9011.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-011 (San Rafael) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-011. Corré scraper_ies_9011.py primero.")

# 21. Sumamos el IES 9-012 (Informática San Rafael)
if os.path.exists(DIR_DATOS / "ies9012.json"):
    with open(DIR_DATOS / "ies9012.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-012 (Informática) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-012. Corré scraper_ies_9012.py primero.")
    
    # 22. Sumamos el ISTEEC (IES 9-013 - Capital)
if os.path.exists(DIR_DATOS / "ies9013.json"):
    with open(DIR_DATOS / "ies9013.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del ISTEEC (IES 9-013) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del ISTEEC. Corré scraper_ies_9013.py primero.")
    
    # 23. Sumamos el IES 9-014 (Profesorado de Arte - IPA)
if os.path.exists(DIR_DATOS / "ies9014.json"):
    with open(DIR_DATOS / "ies9014.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-014 (Profesorado de Arte) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-014. Corré scraper_ies_9014.py primero.")
    
    # 24. Sumamos el IESVU (IES 9-015 Valle de Uco)
if os.path.exists(DIR_DATOS / "ies9015.json"):
    with open(DIR_DATOS / "ies9015.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IESVU (IES 9-015) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IESVU. Corré scraper_ies_9015.py primero.")

# 25. Sumamos el IEF (IES 9-016 - Godoy Cruz)
if os.path.exists(DIR_DATOS / "ies9016.json"):
    with open(DIR_DATOS / "ies9016.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IEF (IES 9-016) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IEF. Corré scraper_ies_9016.py primero.")
    
    # 26. Sumamos la Escuela de Cine (IES 9-017)
if os.path.exists(DIR_DATOS / "ies9017.json"):
    with open(DIR_DATOS / "ies9017.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la Escuela de Cine (IES 9-017) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-017. Corré scraper_ies_9017.py primero.")
    
    # 27. Sumamos el IES 9-018 (Malargüe)
if os.path.exists(DIR_DATOS / "ies9018.json"):
    with open(DIR_DATOS / "ies9018.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-018 (Malargüe) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-018. Corré scraper_ies_9018.py primero.")
    
    # 28. Sumamos INSUTEC
if os.path.exists(DIR_DATOS / "insutec.json"):
    with open(DIR_DATOS / "insutec.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de INSUTEC cargados al chasis.")
else:
    print("⚠️ Faltan los datos de INSUTEC. Corré scraper_insutec.py primero.")
    
    # 29. Sumamos el IES 9-021 (Junín)
if os.path.exists(DIR_DATOS / "ies9021.json"):
    with open(DIR_DATOS / "ies9021.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-021 cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-021. Corré scraper_ies_9021.py primero.")
    
    # 30. Sumamos el IES 9-023 (Maipú)
if os.path.exists(DIR_DATOS / "ies9023.json"):
    with open(DIR_DATOS / "ies9023.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-023 cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-023. Corré scraper_ies_9023.py primero.")
    
    # 31. Sumamos el IES 9-024 (Lavalle)
if os.path.exists(DIR_DATOS / "ies9024.json"):
    with open(DIR_DATOS / "ies9024.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-024 (Lavalle) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-024. Corré scraper_ies_9024.py primero.")
    
    # 32. Sumamos el IES 9-028 (Santa Rosa)
if os.path.exists(DIR_DATOS / "ies9028.json"):
    with open(DIR_DATOS / "ies9028.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-028 (Santa Rosa) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-028. Corré scraper_ies_9028.py primero.")
    
    # 33. Sumamos el IES 9-029 (Luján de Cuyo)
if os.path.exists(DIR_DATOS / "ies9029.json"):
    with open(DIR_DATOS / "ies9029.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-029 (Luján de Cuyo) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-029. Corré scraper_ies_9029.py primero.")
    
    # 34. Sumamos el IES 9-030 (Instituto del Bicentenario)
if os.path.exists(DIR_DATOS / "ies9030.json"):
    with open(DIR_DATOS / "ies9030.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del IES 9-030 (Bicentenario) cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IES 9-030. Corré scraper_ies_9030.py primero.")
    
    # 35. Sumamos el Instituto Fabián Calle (Privado)
if os.path.exists(DIR_DATOS / "fabian_calle.json"):
    with open(DIR_DATOS / "fabian_calle.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto Fabián Calle cargados al chasis.")
else:
    print("⚠️ Faltan los datos del Fabián Calle. Corré scraper_fabian_calle.py primero.")
    
    # 36. Sumamos el Instituto Juan Gutenberg (Privado)
if os.path.exists(DIR_DATOS / "gutenberg.json"):
    with open(DIR_DATOS / "gutenberg.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto Gutenberg cargados al chasis.")
else:
    print("⚠️ Faltan los datos del Gutenberg. Corré scraper_gutenberg.py primero.")
    
    # 37. Sumamos Fundación Rayuela (Privado)
if os.path.exists(DIR_DATOS / "rayuela.json"):
    with open(DIR_DATOS / "rayuela.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de Fundación Rayuela cargados al chasis.")
else:
    print("⚠️ Faltan los datos de Rayuela. Corré scraper_rayuela.py primero.")
    
    # 38. Sumamos Intercultural Cursos de Idiomas (Privado)
if os.path.exists(DIR_DATOS / "intercultural.json"):
    with open(DIR_DATOS / "intercultural.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de Intercultural cargados al chasis.")
else:
    print("⚠️ Faltan los datos de Intercultural. Corré scraper_intercultural.py primero.")
    
    # 39. Sumamos el Instituto de Arte Chopin (Privado)
if os.path.exists(DIR_DATOS / "chopin.json"):
    with open(DIR_DATOS / "chopin.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto de Arte Chopin cargados al chasis.")
else:
    print("⚠️ Faltan los datos de Chopin. Corré scraper_chopin.py primero.")
    
    # 40. Sumamos el Instituto Maipú de Educación Integral - IMEI (Privado)
if os.path.exists(DIR_DATOS / "imei.json"):
    with open(DIR_DATOS / "imei.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto IMEI cargados al chasis.")
else:
    print("⚠️ Faltan los datos del IMEI. Corré scraper_imei.py primero.")
    
    # 41. Sumamos el Instituto Santísima Trinidad (Privado)
if os.path.exists(DIR_DATOS / "trinidad.json"):
    with open(DIR_DATOS / "trinidad.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto Santísima Trinidad cargados al chasis.")
else:
    print("⚠️ Faltan los datos del Santísima Trinidad. Corré scraper_trinidad.py primero.")
    
    # 42. Sumamos la Escuela de Periodismo Deportivo de Mendoza - EPD (Privado)
if os.path.exists(DIR_DATOS / "epd.json"):
    with open(DIR_DATOS / "epd.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la EPD cargados al chasis.")
else:
    print("⚠️ Faltan los datos de la EPD. Corré scraper_epd.py primero.")
    
    # 43. Sumamos la Escuela de Psicología Social (Privado)
if os.path.exists(DIR_DATOS / "psicosocial.json"):
    with open(DIR_DATOS / "psicosocial.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos de la Escuela de Psicología Social cargados al chasis.")
else:
    print("⚠️ Faltan los datos de Psicología Social. Corré scraper_psicosocial.py primero.")
    
    # 44. Sumamos el nuevo Instituto (Privado)
if os.path.exists(DIR_DATOS / "malvinas.json"):
    with open(DIR_DATOS / "malvinas.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto cargados al chasis.")
else:
    print("⚠️ Faltan los datos del archivo. Corré el script correspondiente primero.")
    
    # 46. Sumamos el nuevo Instituto Superior
if os.path.exists(DIR_DATOS / "insrp.json"):
    with open(DIR_DATOS / "insrp.json", "r", encoding="utf-8") as f:
        datos = json.load(f)
        instituciones.extend(datos.get("instituciones", []))
    print("✅ Datos del Instituto cargados al chasis.")
else:
    print("⚠️ Faltan los datos del instituto. Corré scraper_insrp.py primero.")

# Higiene y Seguridad: son tecnicaturas, no oficios, así que van al catálogo formal.
# Si la institución ya está cargada se le agregan las carreras (para no duplicarla);
# si no está, se suma entera.
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
}

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

# Unificamos todo en el data.json maestro
base_final = {"instituciones": instituciones, **grupos_aparte}
guardar_json(base_final, "data.json")
print("\n🎉 ¡Listo el pollo! Archivo 'data.json' maestro generado con las tres universidades adentro.")

# Encadenamos automáticamente la inyección de plataformas online para que
# data.json nunca quede sin la sección "plataformas" por olvido de correr
# plataforma.py a mano después de este script.
print("\n🔌 Inyectando plataformas online...")
subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "plataforma.py")], check=True)