#!/usr/bin/env python3
"""
Exporta tablas Excel de VERTEX RD a JSON para el geoportal web.
Ejecutar desde la raíz del monorepo VERTEXRD o ajustar BASE_PATH.
"""
import json
import os
import sys

import pandas as pd

BASE_PATH = os.environ.get(
    "VERTEX_DATA_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "BASES DE DATOS"),
)
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data")


def to_records(df: pd.DataFrame) -> list:
    return json.loads(df.to_json(orient="records", force_ascii=False))


def main() -> None:
    os.makedirs(OUT_PATH, exist_ok=True)
    tablas = os.path.join(BASE_PATH, "TABLAS")

    dens = pd.read_excel(os.path.join(tablas, "Tbl_Densidades_.xlsx"))
    dens_ren = pd.read_excel(os.path.join(tablas, "Tbl_Densidades_Renacimiento.xlsx"))
    retiros = pd.read_excel(os.path.join(tablas, "Tbl_Retiros_Linderos_.xlsx"))
    predios = pd.read_excel(os.path.join(BASE_PATH, "PREDIOS", "PREDIOS_RD.xlsx"))

    for name, df in [
        ("densidades.json", dens),
        ("densidades_renacimiento.json", dens_ren),
        ("retiros.json", retiros),
    ]:
        with open(os.path.join(OUT_PATH, name), "w", encoding="utf-8") as f:
            json.dump(to_records(df), f, ensure_ascii=False, indent=2)

    lookup_cols = [
        "CATASTRO", "CODIGO", "BARRIO_", "SUB_BARRIO", "POLIGONO", "USO",
        "ACTIVIDAD", "ESTADO_DES", "UT", "NOMBRE_UT", "AREAPREDIO", "ESTRATO",
        "ID_DENSIDADES *", "ID_RETIROS *", "CATEGORIA", "TIPOS",
    ]
    lookup = predios[lookup_cols].fillna("").to_dict("records")
    lookup_dict = {str(r["CATASTRO"]): r for r in lookup if r["CATASTRO"]}

    with open(os.path.join(OUT_PATH, "predios_lookup.json"), "w", encoding="utf-8") as f:
        json.dump(lookup_dict, f, ensure_ascii=False, indent=2)

    print(f"OK — JSON exportados en {OUT_PATH}")
    print(f"  predios_lookup: {len(lookup_dict)} registros")


if __name__ == "__main__":
    main()
