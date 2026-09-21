#!/usr/bin/env python3
"""Cargador genérico de planes de estudio transcriptos a mano.

Lee `data/planes_manual.json` (institucion json -> carrera -> plan) y lo aplica
a los datos. Idempotente: solo completa carreras sin plan.

Uso: python3 scrapers/planes_carga.py [--dry]
"""
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, "data")


def main():
    dry = "--dry" in sys.argv
    with open(os.path.join(DATA, "planes_manual.json"), encoding="utf-8") as f:
        manual = json.load(f)
    total = 0
    for archivo, carreras in manual.items():
        ruta = os.path.join(DATA, archivo)
        if not os.path.exists(ruta):
            print(f"!! no existe {archivo}")
            continue
        with open(ruta, encoding="utf-8") as f:
            doc = json.load(f)
        asignadas = 0
        for inst in doc.get("instituciones", []):
            for c in inst.get("carreras", []):
                nombre = c["nombre_carrera"]
                if nombre not in carreras or c.get("plan_estudio"):
                    continue
                valor = carreras[nombre]
                if isinstance(valor, dict):
                    plan = valor.get("plan", [])
                    fuente = valor.get("fuente")
                else:
                    plan = valor
                    fuente = None
                c["plan_estudio"] = plan
                if fuente:
                    c["plan_fuente"] = fuente
                asignadas += 1
                n = sum(len(a["materias"]) for a in plan)
                print(f"   OK  {nombre[:52]:54} {len(plan)}a/{n}m")
        for nombre in carreras:
            if not any(nombre == c["nombre_carrera"]
                       for i in doc.get("instituciones", []) for c in i.get("carreras", [])):
                print(f"   ?? carrera no encontrada: {nombre}")
        if asignadas and not dry:
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
                f.write("\n")
        total += asignadas
        print(f"### {archivo} — {asignadas} asignadas{'  (DRY RUN)' if dry else ''}")
    print(f"\nTotal: {total} planes manuales aplicados")


if __name__ == "__main__":
    main()
