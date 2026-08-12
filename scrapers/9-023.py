from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V30 para el IES 9-023...")
print("🔍 Set up: Extrayendo nombres desde botones y ajustando cilindrada (3 y 4 años).\n")

carreras_viejas = carreras_guardadas("ies9023.json")
ies_data = {
    "id": 30,
    "nombre": "IES 9-023",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@ies9023.edu.ar",
        "direccion": "Maipú, Mendoza"
    },
    "carreras": []
}

url_base = "https://ies9023-infd.mendoza.edu.ar/sitio/oferta-academica-2/"
id_global = 3000
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Abriendo el capó en: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos directo los enlaces que tienen la clase de botón
    enlaces = sopa.find_all('a', class_='wp-block-button__link')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        nombre_crudo = a.get_text(strip=True)
        
        if not link_oficial or not nombre_crudo:
            continue
            
        nombre_lower = nombre_crudo.lower()
        
        # Filtramos para asegurarnos que agarramos solo carreras
        if "profesorado" in nombre_lower or "tecnicatura" in nombre_lower:
            if link_oficial in carreras_procesadas:
                continue
            carreras_procesadas.add(link_oficial)
            
            # --- MAGIA MECÁNICA: Chapa y pintura al texto en mayúsculas ---
            nombre_carrera = nombre_crudo.title()
            for palabra in [' De ', ' En ', ' Y ', ' Para ', ' La ', ' El ', ' Con ']:
                nombre_carrera = nombre_carrera.replace(palabra, palabra.lower())
                
            if nombre_carrera in carreras_viejas:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera}")
            else:
                print(f"  🔍 Carrera detectada: {nombre_carrera}")
                
                # Asignamos la categoría y duración automáticamente
                if "profesorado" in nombre_lower:
                    categoria = "Grado / Profesorado"
                    duracion = "4 años"
                else:
                    categoria = "Pregrado / Tecnicatura"
                    duracion = "3 años"
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria,
                    "duracion": duracion,
                    "modalidad": "Presencial",
                    "turno": "A confirmar",
                    "facultad": "IES 9-023",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Bujías limpias! Se extrajeron {contador} carreras del IES 9-023.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-023: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9023.json")
print("🎉 Archivo 'ies9023.json' guardado correctamente.")