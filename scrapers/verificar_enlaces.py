"""Verifica que los links oficiales del catálogo respondan de verdad.

Recorre data/data.json (instituciones, formaciones alternativas y oficios
técnicos), pide cada link_oficial con cabecera de navegador y lo clasifica:

    ok        la web respondió (2xx/3xx)
    bloqueado vive, pero nos rechaza (403, 429, timeout, SSL): hay que mirarlo
              a mano en el navegador antes de darlo por roto
    roto      404, 410 o el dominio no existe: el link no sirve
    sin-link  el valor es "A confirmar" o no es una URL

Un HEAD que responde 4xx/5xx no decide nada: muchos servidores rechazan HEAD y
sirven el GET. Por eso, ante cualquier duda, manda el GET.

Uso:
    python scrapers/verificar_enlaces.py
    python scrapers/verificar_enlaces.py --json reporte-enlaces.json

Sale con código 1 si hay links rotos o sin link: sirve para encadenarlo en un
chequeo previo al build.
"""

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

from scraper_utils import DIR_DATOS

CABECERAS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9",
}
ESPERA = 20
TRABAJADORES = 12

# Códigos con los que la web existe pero no nos deja entrar. No son un link
# roto: son un "verificalo en el navegador".
BLOQUEADOS = {401, 403, 405, 406, 409, 418, 429, 503}
ROTOS = {404, 410, 451}

PISTAS_SIN_LINK = {"", "a confirmar", "verificar en web oficial",
                   "verificar en página oficial", "consultar en la web",
                   "no especificada"}

GRUPOS = (
    ("instituciones", "institución"),
    ("formaciones_alternativas", "formación alternativa"),
    ("oficios_tecnicos", "oficio técnico"),
)


def _pedir(url, metodo):
    return requests.request(
        metodo, url, headers=CABECERAS, timeout=ESPERA, allow_redirects=True
    )


def clasificar(url):
    """Devuelve (estado, detalle) para una URL del catálogo."""
    valor = (url or "").strip()
    if valor.lower() in PISTAS_SIN_LINK or not valor.startswith("http"):
        return "sin-link", valor or "(vacío)"

    ultimo = "sin respuesta"
    for metodo in ("HEAD", "GET"):
        try:
            respuesta = _pedir(valor, metodo)
            if respuesta.status_code < 400:
                return "ok", str(respuesta.status_code)
            ultimo = str(respuesta.status_code)
            if metodo == "HEAD":
                # Un HEAD rechazado no decide: el GET tiene la última palabra.
                continue
            if respuesta.status_code in ROTOS:
                return "roto", ultimo
            if respuesta.status_code in BLOQUEADOS:
                return "bloqueado", ultimo
            return "bloqueado", ultimo
        except requests.exceptions.Timeout:
            ultimo = "timeout"
        except requests.exceptions.SSLError:
            ultimo = "SSL"
        except requests.exceptions.ConnectionError as error:
            texto = str(error)
            es_dns = any(pista in texto for pista in (
                "Name or service not known", "nodename nor servname",
                "getaddrinfo failed", "Temporary failure in name resolution",
            ))
            ultimo = "DNS" if es_dns else "conexión"
        except requests.exceptions.TooManyRedirects:
            return "roto", "redirección infinita"
        except requests.exceptions.RequestException as error:
            ultimo = type(error).__name__

    if ultimo == "DNS":
        return "roto", ultimo
    return "bloqueado", ultimo


def recolectar():
    """Devuelve {url: [(grupo, institución, carrera), ...]} desde data.json."""
    with open(DIR_DATOS / "data.json", "r", encoding="utf-8") as archivo:
        datos = json.load(archivo)

    origenes = {}
    for clave, etiqueta in GRUPOS:
        for institucion in datos.get(clave, []):
            for carrera in institucion.get("carreras", []):
                url = carrera.get("link_oficial")
                if url is None:
                    continue
                carrera_nombre = carrera.get("nombre_carrera") or carrera.get("nombre") or "?"
                # Los placeholders ("A confirmar") se repiten: si se agruparan por
                # valor, el reporte mostraría una sola carrera y escondería el resto.
                clave_url = url if str(url).strip().startswith("http") else f"{url} :: {carrera_nombre}"
                origenes.setdefault(clave_url, []).append(
                    (etiqueta, institucion.get("nombre", "?"), carrera_nombre)
                )
    return origenes


def verificar(origenes):
    resultados = {}
    with ThreadPoolExecutor(max_workers=TRABAJADORES) as ejecutor:
        estados = list(ejecutor.map(clasificar, origenes))
    for url, (estado, detalle) in zip(origenes, estados):
        resultados[url] = {
            "estado": estado,
            "detalle": detalle,
            "origenes": origenes[url],
        }
    return resultados


def imprimir(resultados):
    conteo = {}
    for datos in resultados.values():
        conteo[datos["estado"]] = conteo.get(datos["estado"], 0) + 1

    print(f"\n🔗 Links verificados: {len(resultados)} únicos")
    print(f"   ✅ ok: {conteo.get('ok', 0)}")
    print(f"   🚫 bloqueados (verificar a mano): {conteo.get('bloqueado', 0)}")
    print(f"   ❌ rotos: {conteo.get('roto', 0)}")
    print(f"   ⚠️  sin link: {conteo.get('sin-link', 0)}")

    for estado, titulo in (("roto", "❌ LINKS ROTOS"), ("sin-link", "⚠️  SIN LINK")):
        filas = [(url, d) for url, d in resultados.items() if d["estado"] == estado]
        if not filas:
            continue
        print(f"\n{titulo} ({len(filas)})")
        for url, datos in sorted(filas):
            grupo, institucion, carrera = datos["origenes"][0]
            print(f"   [{datos['detalle']}] {url}")
            print(f"        {institucion} — {carrera} ({grupo})")

    bloqueados = [(u, d) for u, d in resultados.items() if d["estado"] == "bloqueado"]
    if bloqueados:
        print(f"\n🚫 BLOQUEADOS ({len(bloqueados)}): la web existe pero rechaza el pedido.")
        print("   Se revisan en el navegador; no se tocan sin antes confirmar.")
        for url, datos in sorted(bloqueados)[:30]:
            print(f"   [{datos['detalle']}] {url}")
        if len(bloqueados) > 30:
            print(f"   … y {len(bloqueados) - 30} más (ver reporte JSON)")


def main():
    parser = argparse.ArgumentParser(description="Verifica los links oficiales de data.json")
    parser.add_argument("--json", dest="ruta_json", help="además, guarda el reporte en ese archivo")
    args = parser.parse_args()

    origenes = recolectar()
    if not origenes:
        print("⚠️ No encontré links para verificar. ¿Corriste scrapers/unir_todo.py?")
        return 1

    resultados = verificar(origenes)
    imprimir(resultados)

    if args.ruta_json:
        salida = Path(args.ruta_json)
        with open(salida, "w", encoding="utf-8") as archivo:
            json.dump(resultados, archivo, ensure_ascii=False, indent=2)
        print(f"\n🧾 Reporte guardado en {salida}")

    return 1 if any(d["estado"] in ("roto", "sin-link") for d in resultados.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
