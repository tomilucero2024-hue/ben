import requests
from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json


print("🛠️ Rectificando motor V36 para el Instituto Gutenberg...")
print("🔍 Set up: Bypass de seguridad y búsqueda inversa desde los títulos H4.\n")

carreras_viejas = carreras_guardadas("gutenberg.json")
# --- 1. INYECCIÓN MANUAL: La Tecnicatura ---
carreras_gutenberg = []
tecnicatura_nombre = "Tecnicatura Superior en Diseño Multimedial"

if tecnicatura_nombre in carreras_viejas:
    carreras_gutenberg.append(carreras_viejas[tecnicatura_nombre])
    print(f"  ⏭️ Recuperada de memoria: {tecnicatura_nombre}")
else:
    carreras_gutenberg.append({
        "id": 3601,
        "nombre_carrera": tecnicatura_nombre,
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "modalidad": "A Distancia", 
        "turno": "A confirmar",
        "facultad": "Instituto Juan Gutenberg",
        "link_oficial": "https://institutojgutenberg2.lovable.app/"
    })
    print("  🔧 Inyectada la Tecnicatura con el link de la captura.")

ies_data = {
    "id": 36,
    "nombre": "Instituto Juan Gutenberg",
    "nivel": "terciario",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@institutojgutenberg.edu.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_gutenberg
}

# --- 2. ESCÁNER BLINDADO: Los Cursos ---
url_cursos = "https://institutojgutenberg.edu.ar/cursos-online-gutenberg/"
id_global = 3602
contador_cursos = 0

try:
    print(f"\n📍 Conectando con camuflaje a: {url_cursos}")
    # Disfrazamos el script para que pase los filtros de seguridad
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
    }
    
    req = requests.get(url_cursos, headers=headers, timeout=15)
    print(f"  🚦 Estado del servidor: {req.status_code} (Si es 200, estamos adentro)")
    
    sopa = BeautifulSoup(req.text, 'html.parser')
    
    # PLAN B: Buscamos primero todos los títulos h4
    titulos = sopa.find_all('h4', class_='elementor-heading-title')
    
    for h4 in titulos:
        nombre_crudo = h4.get_text(strip=True)
        
        # Subimos al contenedor padre (la columna entera) para buscar el botón
        columna = h4.find_parent('div', class_='elementor-column')
        
        if columna:
            btn_span = columna.find('span', class_='elementor-button-text')
            
            if btn_span:
                duracion_cruda = btn_span.get_text(strip=True)
                
                # Filtro de nafta: asegurarnos de que la duración hable de meses o años
                if len(nombre_crudo) > 4 and ("mes" in duracion_cruda.lower() or "año" in duracion_cruda.lower() or "ano" in duracion_cruda.lower()):
                    
                    nombre_curso = nombre_crudo.title()
                    for palabra in [' De ', ' En ', ' Y ', ' Para ', ' La ', ' El ', ' Con ']:
                        nombre_curso = nombre_curso.replace(palabra, palabra.lower())
                    
                    if nombre_curso in carreras_viejas:
                        ies_data["carreras"].append(carreras_viejas[nombre_curso])
                    else:
                        print(f"  🔍 Curso cazado: {nombre_curso} ({duracion_cruda})")
                        ies_data["carreras"].append({
                            "id": id_global,
                            "nombre_carrera": nombre_curso,
                            "categoria": "Curso / Formación Profesional",
                            "duracion": duracion_cruda,
                            "modalidad": "A Distancia",
                            "turno": "A confirmar",
                            "facultad": "Instituto Juan Gutenberg",
                            "link_oficial": url_cursos
                        })
                        id_global += 1
                        contador_cursos += 1
                        
    print(f"\n✅ ¡Filtro destapado! Se detectaron {contador_cursos} cursos online.")

except Exception as e:
    print(f"⚠️ Falla mecánica escaneando cursos: {e}")

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "gutenberg.json")
print("🎉 Archivo 'gutenberg.json' guardado correctamente.")