import os
import re
from pathlib import Path

from bs4 import BeautifulSoup

from scraper_utils import carreras_guardadas, guardar_json, pedir_sopa

# Rutas resueltas desde la ubicación de este archivo, para que los scripts
# funcionen sin importar desde qué carpeta se los ejecute.
DIR_FUENTES = Path(__file__).resolve().parent / "fuentes"


print("🛠️ Encendiendo el escáner V8 para la UCA...")
print("⚠️ Ojo: Detectamos Angular. Sistema de inyección dual activado.\n")

carreras_viejas = carreras_guardadas("uca.json")
uca_data = {
    "id": 8,
    "nombre": "Universidad Católica Argentina (UCA)",
    "nivel": "universidad",
    "gestion": "privada", # 👈 La etiqueta naranja
    "provincia": "Mendoza",
    "contacto": {
        "telefono": "4429400",
        "email": "ingresomendoza@uca.edu.ar",
        "direccion": "Uruguay 750, Godoy Cruz"
    },
    "carreras": []
}

id_global = 800
contador = 0

# Función para destripar la sopa (sea de la web o de un archivo local)
def procesar_sopa(sopa):
    global id_global, contador
    
    # Buscamos la fila principal (Captura 3)
    filas = sopa.find_all('tr', id='resultado-buscador')
    
    for fila in filas:
        tds = fila.find_all('td')
        if len(tds) >= 5:
            sede = tds[3].text.strip()
            
            # 🛑 EL FILTRO DE MENDOZA: Si no es de Mendoza, la pasamos por alto
            if "mendoza" not in sede.lower():
                continue
                
            nombre_carrera = tds[1].text.strip()
            facultad_texto = "UCA - " + tds[4].text.strip()
            
            # Buscamos la fila detalle (que está justo abajo de la fila principal)
            fila_detalle = fila.find_next_sibling('tr')
            duracion_texto = "Verificar en web oficial"
            link_real = "https://uca.edu.ar/es/ingreso"
            
            if fila_detalle:
                # Sacar duración (Captura 2)
                p_duracion = fila_detalle.find('p', string=re.compile('Duración', re.IGNORECASE))
                if p_duracion:
                    p_valor = p_duracion.find_next_sibling('p')
                    if p_valor:
                        duracion_texto = p_valor.text.strip()
                
                # Sacar Link (Captura 1)
                link_btn = fila_detalle.find('a', string=re.compile('MÁS INFO', re.IGNORECASE))
                if link_btn and 'href' in link_btn.attrs:
                    href = link_btn['href']
                    link_real = href if href.startswith('http') else f"https://uca.edu.ar/{href.lstrip('/')}"
            
            print(f"  ✅ Pescada (Mendoza): {nombre_carrera}")
            
            uca_data["carreras"].append({
                "id": id_global,
                "nombre_carrera": nombre_carrera,
                "categoria": "Grado / Carrera",
                "duracion": duracion_texto,
                "modalidad": "Presencial",
                "facultad": facultad_texto,
                "link_oficial": link_real
            })
            id_global += 1
            contador += 1

# INTENTO 1: Raspado Local (Si el usuario puenteó Angular)
archivo_html_local = DIR_FUENTES / "uca_codigo.html"
if os.path.exists(archivo_html_local):
    print(f"📁 Se encontró '{archivo_html_local}'. Extrayendo datos puenteados...")
    with open(archivo_html_local, "r", encoding="utf-8") as f:
        sopa_local = BeautifulSoup(f.read(), 'html.parser')
        procesar_sopa(sopa_local)
else:
    # INTENTO 2: Raspado Web Directo
    print("🌐 Intentando raspar directo desde la web...")
    try:
        url_uca = "https://uca.edu.ar/es/ingreso"
        sopa = pedir_sopa(url_uca)
        procesar_sopa(sopa_web)
    except Exception as e:
        print(f"⚠️ Fallo web: {e}")

# CHEQUEO DE RESULTADOS Y DIAGNÓSTICO
if contador == 0:
    print("\n❌ CERO CARRERAS ENCONTRADAS.")
    print("Mecánica: Angular bloqueó el escáner. Necesitamos puentear el sistema.")
    print("PASOS PARA SOLUCIONARLO:")
    print("  1. Entrá a https://uca.edu.ar/es/ingreso en Chrome.")
    print("  2. Hacé clic derecho en la tabla de carreras -> 'Inspeccionar'.")
    print("  3. Buscá la etiqueta <tbody>, clic derecho -> Copy -> Copy element (o Copy OuterHTML).")
    print("  4. Creá un archivo llamado 'uca_codigo.html' en esta misma carpeta, pegá eso y guardá.")
    print("  5. Volvé a correr este script.")
else:
    print(f"\n✅ ¡Manso! Se guardaron {contador} carreras de la UCA Sede Mendoza.")
    
    base_uca = {"instituciones": [uca_data]}
    guardar_json(base_uca, "uca.json")
    print("🎉 Archivo 'uca.json' listo para la calle.")