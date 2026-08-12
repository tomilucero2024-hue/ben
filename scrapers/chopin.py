from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa


print("🛠️ Rectificando motor V39 (Instituto de Arte Chopin)...")
print("🧹 Limpiando piezas basura y dejando solo los cursos reales.\n")

carreras_viejas = carreras_guardadas("chopin.json")
carreras_chopin = []
id_global = 3901

# --- 1. CAPACITACIÓN LABORAL: Los Cursos (Filtrados y limpios) ---
url_cursos = "https://arteschopin.edu.ar/instituto-privado-de-capacitacion-laboral/"
print(f"📍 Escaneando cursos limpios en: {url_cursos}")

try:
    sopa = pedir_sopa(url_cursos)
    titulos_cursos = sopa_cursos.find_all('h4', class_='gutentor-text')
    
    # Palabras clave que queremos filtrar y tirar a la basura
    basura = ["información de contacto", "requisitos", "inscripción", "secundario", "instituto privado de capacitación"]

    for h4 in titulos_cursos:
        nombre_crudo = h4.get_text(separator=" ", strip=True)
        nombre_lower = nombre_crudo.lower()
        
        # Filtro mecánico: si es muy corto o es texto institucional, lo saltamos
        if len(nombre_crudo) < 4:
            continue
        if any(b in nombre_lower for b in basura):
            print(f"  🗑️ Descartando basura: {nombre_crudo}")
            continue
            
        nombre_curso = nombre_crudo.title()
        for palabra in [' De ', ' En ', ' Y ', ' Para ', ' La ', ' El ', ' Con ']:
            nombre_curso = nombre_curso.replace(palabra, palabra.lower())
            
        if nombre_curso in carreras_viejas:
            carreras_chopin.append(carreras_viejas[nombre_curso])
        else:
            print(f"  🔍 Curso real detectado: {nombre_curso} (5 meses)")
            carreras_chopin.append({
                "id": id_global,
                "nombre_carrera": nombre_curso,
                "categoria": "Curso / Formación Profesional",
                "duracion": "5 meses",
                "modalidad": "Presencial",
                "turno": "A confirmar",
                "facultad": "Instituto de Arte Chopin",
                "link_oficial": url_cursos
            })
            id_global += 1
except Exception as e:
    print(f"⚠️ Error escaneando cursos de Chopin: {e}")

# --- 2. TERCIARIO: Tecnicaturas y Profesorados (Los de la otra vez) ---
terciarios = [
    {
        "nombre": "Tecnicatura Superior en Danza",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "link": "https://arteschopin.edu.ar/tecnicatura-superior-en-danza/"
    },
    {
        "nombre": "Tecnicatura Superior en Dirección Coral",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "link": "https://arteschopin.edu.ar/tecnicatura-superior-en-direccion-coral/"
    },
    {
        "nombre": "Profesorado en Música",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "link": "https://arteschopin.edu.ar/profesorado-en-musica/"
    },
    {
        "nombre": "Profesorado en Danza",
        "categoria": "Grado / Profesorado",
        "duracion": "4 años",
        "link": "https://arteschopin.edu.ar/profesorado-en-danza/"
    },
    {
        "nombre": "Tecnicatura Superior en Gestión de Industrias Culturales y Creativas",
        "categoria": "Pregrado / Tecnicatura",
        "duracion": "3 años",
        "link": "https://arteschopin.edu.ar/tecnicatura-superior-en-gestion-de-industrias-culturales-y-creativas/"
    }
]

for t in terciarios:
    if t["nombre"] in carreras_viejas:
        carreras_chopin.append(carreras_viejas[t["nombre"]])
    else:
        print(f"  🔍 Terciario inyectado: {t['nombre']} ({t['duracion']})")
        carreras_chopin.append({
            "id": id_global,
            "nombre_carrera": t["nombre"],
            "categoria": t["categoria"],
            "duracion": t["duracion"],
            "modalidad": "Presencial",
            "turno": "A confirmar",
            "facultad": "Instituto de Arte Chopin",
            "link_oficial": t["link"]
        })
        id_global += 1

ies_data = {
    "id": 39,
    "nombre": "Instituto de Arte Chopin",
    "nivel": "terciario",
    "gestion": "privada",
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "A confirmar",
        "email": "contacto@arteschopin.edu.ar",
        "direccion": "Mendoza"
    },
    "carreras": carreras_chopin
}

base_ies = {"instituciones": [ies_data]}
guardar_json(base_ies, "chopin.json")
print(f"\n🎉 ¡Motor limpio y calibrado! Se cargaron {len(carreras_chopin)} opciones válidas.")