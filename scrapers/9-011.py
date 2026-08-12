import re

from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Encendiendo el escáner V20 para IES 9-011 Del Atuel (San Rafael)...")
print("🔍 Leyendo números de chasis (URLs) para sacar los nombres exactos.\n")

carreras_viejas = carreras_guardadas("ies9011.json")
ies_data = {
    "id": 20,
    "nombre": "IES 9-011 Del Atuel",
    "nivel": "terciario",
    "gestion": "pública",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "0260-4422794",
        "email": "ies9011@infd.edu.ar",
        "direccion": "Maza 750, San Rafael, Mendoza"
    },
    "carreras": []
}

url_base = "https://ies9011-infd.mendoza.edu.ar/sitio/oferta-educativa/"
id_global = 2000 
contador = 0
carreras_procesadas = set()

try:
    print(f"📍 Analizando las tablas de oferta en: {url_base}")
    sopa = pedir_sopa(url_base)
    # Buscamos todos los links de la página
    enlaces = sopa.find_all('a')
    
    for a in enlaces:
        link_oficial = a.get('href', '')
        
        if not link_oficial or link_oficial in carreras_procesadas:
            continue
            
        # Filtramos para agarrar solo los links de carreras reales
        if "/sitio/profesorado" in link_oficial or "/sitio/tecnicatura" in link_oficial:
            carreras_procesadas.add(link_oficial)
            
            # --- MAGIA MECÁNICA: Transformamos el link en el nombre ---
            slug = link_oficial.strip('/').split('/')[-1]
            slug = re.sub(r'-\d+$', '', slug) # Borramos números sueltos del final
            
            nombre_carrera = slug.replace('-', ' ').title()
            
            # Prolijidad para las preposiciones
            for palabra in [' De ', ' En ', ' Y ', ' Con ', ' La ']:
                nombre_carrera = nombre_carrera.replace(palabra, palabra.lower())
                
            nombre_lower = nombre_carrera.lower()
            
            if nombre_carrera in carreras_viejas:
                ies_data["carreras"].append(carreras_viejas[nombre_carrera])
                print(f"  ⏭️ Recuperada: {nombre_carrera[:35]}...")
            else:
                print(f"  🔍 Carrera detectada desde URL: {nombre_carrera}")
                
                # Asignamos cilindrada (duración y categoría)
                if "profesorado" in nombre_lower:
                    categoria_actual = "Grado / Profesorado"
                    duracion_texto = "4 años"
                else:
                    categoria_actual = "Pregrado / Tecnicatura"
                    duracion_texto = "3 años"
                
                ies_data["carreras"].append({
                    "id": id_global,
                    "nombre_carrera": nombre_carrera,
                    "categoria": categoria_actual,
                    "duracion": duracion_texto,
                    "modalidad": "Presencial",
                    "turno": "A confirmar",
                    "facultad": "IES 9-011 Del Atuel",
                    "link_oficial": link_oficial
                })
                id_global += 1
                contador += 1
                
    print(f"\n✅ ¡Trabajo impecable! Se extrajeron {contador} carreras del IES 9-011.")

except Exception as e:
    print(f"⚠️ Falla mecánica en IES 9-011: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "ies9011.json")
print("🎉 Archivo 'ies9011.json' guardado correctamente.")