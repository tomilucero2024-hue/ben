"""Extracción del plan de estudios de la UCh desde sus PDFs oficiales.

Los PDFs de la U. Champagnat (https://www.uch.edu.ar/docs/*.pdf) tienen dos
formatos según el año de la carrera:

- Formato viejo ("Primer Semestre"/"Segundo Semestre"): cada tramo de un año de
  cursada es el par Primer→Segundo semestre. Se corta el tramo nuevo en cada
  "Primer Semestre".
- Formato nuevo (marcadores "N° AÑO" giratorios a x<130): cada línea "2° AÑO"
  (o superior) inicia el tramo nuevo.

La capa de texto de estos PDFs está rota (ToUnicode ausente, fuente Alegreya/
PatuaOne embebida con cmap ilegible): pdftotext vierte glifos como
"£ťýŰōǽĚýĚōŻŰ" en lugar de las letras reales. Los nombres afectados están
verificados visualmente vía OCR en CORRUPTS (ver uch_parser.py).
"""

import json
import os
import re
import subprocess
import tempfile

import requests

import uch_parser as up

PLAN_FUENTE_BASE = "https://www.uch.edu.ar/docs/"


def extraer_plan_pdf(url_pdf):
    """Descarga el PDF y devuelve {'plan_estudio': [...], 'plan_fuente': url} o None.

    El archivo temporal se guarda con el nombre del PDF de la URL: uch_parser
    corrige glifos corruptos por nombre de archivo (CORRUPTS), así que ese
    nombre tiene que coincidir con el que usa el parser.
    """
    from pathlib import Path
    import tempfile
    base = url_pdf.split("/")[-1].split("?")[0] or "plan.pdf"
    try:
        resp = requests.get(url_pdf, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        resp.raise_for_status()
        tmpdir = tempfile.mkdtemp(prefix="uch_plan_")
        ruta = str(Path(tmpdir) / base)
        with open(ruta, "wb") as f:
            f.write(resp.content)
    except Exception as error:
        print(f"  ⚠️ No se pudo bajar el plan {url_pdf}: {error}")
        return None

    try:
        if up.tiene_semestres(ruta):
            tramos, anomalos = up.parsear(ruta)
        else:
            tramos = up.parsear_nuevo(ruta)
            anomalos = []
        for cod, tn in anomalos:
            print(f"  ⚠️ Glifo raro sin resolver en {url_pdf}: #{cod} -> {tn[:40]}")
    finally:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    if not tramos or not any(tramos):
        return None
    plan = [
        {"anio": f"{k+1}º año", "materias": t}
        for k, t in enumerate(tramos)
    ]
    return {"plan_estudio": plan, "plan_fuente": url_pdf}


if __name__ == "__main__":
    import sys
    for u in sys.argv[1:]:
        r = extraer_plan_pdf(u)
        if r:
            total = sum(len(a["materias"]) for a in r["plan_estudio"])
            print(f"✅ {u}: {len(r['plan_estudio'])} años, {total} materias, fuente {r['plan_fuente']}")
        else:
            print(f"❌ {u}: sin plan")