import json
import os
from pathlib import Path

from scraper_utils import guardar_json, pedir_sopa

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_DATOS = Path(__file__).resolve().parents[1] / "data"


print("🛠️ Prendiendo el escáner para la UMaza (Modo Rápido)...\n")

archivo_umaza = DIR_DATOS / "umaza.json"
carreras_viejas = {}

# Memoria adaptada (ahora la clave es nombre + sede para no mezclar)
if os.path.exists(archivo_umaza):
    try:
        with open(archivo_umaza, "r", encoding="utf-8") as f:
            datos = json.load(f)
            for c in datos["instituciones"][0].get("carreras", []):
                clave = f"{c['nombre_carrera']} - {c['facultad']}"
                carreras_viejas[clave] = c
    except:
        pass

umaza_data = {
    "id": 4,
    "nombre": "Universidad Juan Agustín Maza (UMaza)",
    "nivel": "universidad",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4056200",
        "email": "informes@umaza.edu.ar",
        "direccion": "Acceso Este, Lat. Sur 2245, Guaymallén"
    },
    "carreras": []
}

url_umaza = "https://www.umaza.edu.ar/ingresoumaza"

try:
    sopa = pedir_sopa(url_umaza)
    # 🎯 Buscamos el contenedor exacto que me mostraste en la foto
    tarjetas = sopa.find_all('div', class_='card-body')
    
    id_global = 400 # Arrancamos en 400 para no chocar con las otras facus
    contador = 0
    
    for tarjeta in tarjetas:
        titulo = tarjeta.find('h5', class_='card-title')
        if titulo:
            nombre_carrera = titulo.text.strip()
            
            # Buscamos los links de las sedes adentro del <p>
            parrafo_links = tarjeta.find('p', class_='card-text')
            if parrafo_links:
                enlaces = parrafo_links.find_all('a')
                
                # Por cada sede que tenga la carrera, armamos una tarjeta nueva
                for enlace in enlaces:
                    sede = enlace.text.strip()
                    href = enlace.get('href', '')
                    
                    # Como el href es relativo ("landings/abogacia/inicio"), le pegamos la web base adelante
                    if href and not href.startswith('http'):
                        link_real = f"https://www.umaza.edu.ar/{href.lstrip('/')}"
                    else:
                        link_real = href
                    
                    facultad_texto = f"UMaza - {sede}"
                    clave_memoria = f"{nombre_carrera} - {facultad_texto}"
                    
                    # Verificamos si ya estaba guardada de antes
                    if clave_memoria in carreras_viejas:
                        umaza_data["carreras"].append(carreras_viejas[clave_memoria])
                        print(f"  ⏭️ Recuperada: {nombre_carrera} ({sede})")
                    else:
                        print(f"  🔍 Cazada: {nombre_carrera} ({sede})")
                        umaza_data["carreras"].append({
                            "id": id_global,
                            "nombre_carrera": nombre_carrera,
                            "categoria": "Grado / Carrera",
                            "duracion": "Verificar en web oficial", # Corta la bocha
                            "modalidad": "Presencial",
                            "facultad": facultad_texto,
                            "link_oficial": link_real
                        })
                    id_global += 1
                    contador += 1
                    
    print(f"\n✅ ¡Manso! Se guardaron {contador} opciones de la UMaza en un parpadeo.")

except Exception as e:
    print(f"⚠️ Error general en UMaza: {e}")

base_umaza = {"instituciones": [umaza_data]}
guardar_json(base_umaza, "umaza.json")
print("🎉 Archivo 'umaza.json' listo para la calle.")