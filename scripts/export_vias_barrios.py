#!/usr/bin/env python3
"""Agrega longitud vial por barrio desde VIAS.shp → data/vias_por_barrio.json"""
import json
import os
from pathlib import Path

import geopandas as gpd

BASE = os.environ.get("VERTEX_ROOT", os.path.join(os.path.dirname(__file__), "..", ".."))
SHP = os.path.join(BASE, "SHAPEFILES", "VIAS.shp")
OUT = Path(__file__).resolve().parents[1] / "data" / "vias_por_barrio.json"


def main():
    gdf = gpd.read_file(SHP)
    gdf["LARGO"] = gdf["LARGO"].astype(float)
    rows = []
    for barrio, grp in gdf.groupby("BARRIO"):
        name = str(barrio).strip()
        if not name:
            continue
        metros = float(grp["LARGO"].sum())
        rows.append({
            "barrio": name,
            "vias": int(len(grp)),
            "longitud_m": round(metros, 2),
            "longitud_km": round(metros / 1000, 3),
        })
    rows.sort(key=lambda x: x["longitud_m"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK — {len(rows)} barrios → {OUT}")


if __name__ == "__main__":
    main()
