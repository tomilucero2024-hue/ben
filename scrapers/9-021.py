from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V29 para IES 9-021...")
print("🔍 Set up: Extrayendo etiquetas H2, haciendo chapa y pintura a los nombres y unificando el link.\n")

carreras_viejas = carreras_guardadas("ies9021.json")
ies_data = {
    "id": 29,
    "nombre": "IES 9-021 Tecnológico",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@ies9021.edu.ar",
        "direccion": "Junín, Mendoza"
    },
    "carreras": []
}

url_base = "https://ies9021.edu.ar/carreras/"
id_global = 2900
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Tirando un cable directo a: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos los h2 con la clase que vimos en tu captura
    titulos = sopa.find_all('h2', class_='elementor-heading-title')
    
    for t in titulos:
        nombre_crudo = t.get_text(strip=True)
        
        # Filtro de nafta: agarramos solo lo que parezca una carrera (ej: "T. S. EN FARMACIA")
        if "T. S." in nombre_crudo or "T.S." in nombre_crudo or "TECNICATURA" in nombre_crudo.upper():
            
            # --- MAGIA MECÁNICA: Chapa y pintura al nombre ---
            nombre_limpio = nombre_crudo.replace("T. S.", "Tecnicatura Superior").replace("T.S.", "Tecnicatura Superior").title()
            
            # Acomodamos las preposiciones chiquitas para que quede prolijo
            for palabra in [' De ', ' En ', ' Y ', ' El ', ' La ']:
                nombre_limpio = nombre_limpio.replace(palabra, palabra.lower())
                
            if nombre_limpio in carreras_procesadas:
                continue
            carreras_procesadas.add(nombre_limpio)
            
            if nombre_limpio in carreras_viejas:
                ies_data["carreras"].append(carreras_viejas[nombre_limpio])
                print(f"  ⏭️ Recuperada: {nombre_limpio}")
            else:
                print(f"  🔍 Carrera detectada: {nombre_limpio}")
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_limpio,
                    "categoria": "Pregrado / Tecnicatura",
                    "duracion": "3 años",
                    "modalidad": "Presencial",
                    "turno": "A confirmar",
                    "facultad": "IES 9-021",
                    "link_oficial": url_base # Enchufamos la misma URL para todas
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo impecable! Se extrajeron {contador} tecnicaturas del IES 9-021.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-021: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9021.json")
print("🎉 Archivo 'ies9021.json' guardado correctamente.")