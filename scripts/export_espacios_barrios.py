#!/usr/bin/env python3
"""Agrega parques y espacios abiertos por barrio → data/espacios_por_barrio.json"""
import json
import os
from collections import Counter
from pathlib import Path

import geopandas as gpd

BASE = os.environ.get("VERTEX_ROOT", os.path.join(os.path.dirname(__file__), "..", ".."))
PARQUES_SHP = os.path.join(BASE, "SHAPEFILES", "PARQUES_Y_PLAZAS_DN.shp")
ESPACIOS_SHP = os.path.join(BASE, "SHAPEFILES", "SISTEMAS_DE_ESPACIOS_ABIERTOS_POT.shp")
BARRIOS_SHP = os.path.join(BASE, "SHAPEFILES", "BARRIOS.shp")
OUT = Path(__file__).resolve().parents[1] / "data" / "espacios_por_barrio.json"


def _count_by(rows, key):
    c = Counter()
    for val in rows:
        label = str(val).strip() if val is not None else ""
        if not label or label.lower() == "nan":
            label = "Sin categoría"
        c[label] += 1
    return [{"categoria" if key == "categoria" else "clasificacion": k, "cantidad": v}
            for k, v in sorted(c.items(), key=lambda x: -x[1])]


def main():
    barrios = gpd.read_file(BARRIOS_SHP)
    name_by_code = {
        int(r.COD_BARRIO): str(r.DESCRIPCIO).strip()
        for r in barrios.itertuples()
        if r.COD_BARRIO is not None and str(r.DESCRIPCIO).strip()
    }

    parques = gpd.read_file(PARQUES_SHP)
    espacios = gpd.read_file(ESPACIOS_SHP)

    codes = set()
    for df in (parques, espacios):
        for c in df["COD_BARRIO"].dropna().astype(int):
            codes.add(c)

    rows = []
    for code in sorted(codes):
        barrio = name_by_code.get(code, f"Barrio {code}")
        p_grp = parques[parques["COD_BARRIO"].astype(int) == code]
        e_grp = espacios[espacios["COD_BARRIO"].astype(int) == code]
        rows.append({
            "barrio": barrio,
            "cod_barrio": code,
            "parques": int(len(p_grp)),
            "espacios_abiertos": int(len(e_grp)),
            "parques_categoria": _count_by(p_grp["CATEGORIA"], "categoria"),
            "espacios_clasificacion": _count_by(e_grp["CLASIF_POT"], "clasificacion"),
        })

    rows.sort(key=lambda x: x["parques"] + x["espacios_abiertos"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK - {len(rows)} barrios -> {OUT}")


if __name__ == "__main__":
    main()
