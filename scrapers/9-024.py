from urllib.parse import urljoin

from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V31 para el IES 9-024 (Lavalle)...")
print("🔍 Set up: Acoplando links relativos y separando Profesorados (4 años) de Tecnicaturas (3 años).\n")

carreras_viejas = carreras_guardadas("ies9024.json")
ies_data = {
    "id": 31,
    "nombre": "IES 9-024 (Lavalle)",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@ies9024.edu.ar",
        "direccion": "Lavalle, Mendoza"
    },
    "carreras": []
}

url_base = "https://ies9024-infd.mendoza.edu.ar/sitio/"
id_global = 3100
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Tirando la sonda a: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos directo en las listas que están adentro de las secciones
    enlaces = sopa.select('section.seccion ul li a')
    
    for a in enlaces:
        link_relativo = a.get('href', '')
        nombre_carrera = a.get_text(strip=True)
        
        if not link_relativo or not nombre_carrera:
            continue
            
        # --- MAGIA MECÁNICA: Le sumamos la manguera al link relativo ---
        link_oficial = urljoin(url_base, link_relativo)
        
        if link_oficial in carreras_procesadas:
            continue
        carreras_procesadas.add(link_oficial)
        
        if nombre_carrera in carreras_viejas:
            ies_data["carreras"].append(carreras_viejas[nombre_carrera])
            print(f"  ⏭️ Recuperada de memoria: {nombre_carrera}")
        else:
            # El escáner detecta la cilindrada por el nombre
            if "profesorado" in nombre_carrera.lower():
                categoria = "Grado / Profesorado"
                duracion = "4 años"
            else:
                categoria = "Pregrado / Tecnicatura"
                duracion = "3 años"
                
            print(f"  🔍 Carrera en pista: {nombre_carrera} ({duracion})")
            
            ies_data["carreras"].append({
                "id": id_global,
                "nombre_carrera": nombre_carrera,
                "categoria": categoria,
                "duracion": duracion,
                "modalidad": "Presencial",
                "turno": "A confirmar",
                "facultad": "IES 9-024 Lavalle",
                "link_oficial": link_oficial
            })
            id_global += 1
            contador += 1
                
    print(f"\n✅ ¡Bujías nuevas! Se extrajeron {contador} carreras del IES 9-024.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-024: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9024.json")
print("🎉 Archivo 'ies9024.json' guardado correctamente.")