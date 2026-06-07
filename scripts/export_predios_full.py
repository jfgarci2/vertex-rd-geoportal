#!/usr/bin/env python3
"""Exporta 140K predios desde PREDIOS_RD.shp a SQLite + analytics actualizados."""
import json
import os
import sqlite3
import sys

import geopandas as gpd
import pandas as pd

BASE = os.environ.get("VERTEX_ROOT", os.path.join(os.path.dirname(__file__), "..", ".."))
SHP = os.path.join(BASE, "SHAPEFILES", "PREDIOS_RD.shp")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(OUT_DIR, "predios.db")

COLS = [
    "CATASTRO", "CODIGO", "BARRIO_", "SUB_BARRIO", "POLIGONO", "USO", "ACTIVIDAD",
    "ESTADO_DES", "UT", "NOMBRE_UT", "AREAPREDIO", "ESTRATO", "CATEGORIA", "TIPOS",
    "ID_DENSIDA", "ID_RETIROS", "EQUIPAMIEN", "ACT_USO_CO", "DISTRITO", "BP",
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Leyendo {SHP}...")
    gdf = gpd.read_file(SHP)
    print(f"Registros: {len(gdf)}")

    df = gdf[COLS].copy()
    gdf_proj = gdf.to_crs(32619) if gdf.crs and gdf.crs.is_geographic else gdf
    centroids = gdf_proj.geometry.centroid.to_crs(4326)
    df["CENTROID_LNG"] = centroids.x
    df["CENTROID_LAT"] = centroids.y
    df = df.fillna("")
    df["CODIGO"] = df["CODIGO"].astype(str)
    df["ESTRATO"] = pd.to_numeric(df["ESTRATO"], errors="coerce").fillna(0).astype(int)
    df["AREAPREDIO"] = pd.to_numeric(df["AREAPREDIO"], errors="coerce").fillna(0)

    db_target = DB_PATH
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except OSError:
            db_target = DB_PATH + ".new"
            print(f"DB en uso — escribiendo en {db_target} (reemplazar manualmente o reiniciar servidor)")
    conn = sqlite3.connect(db_target)
    df.to_sql("predios", conn, index=False, if_exists="replace")
    conn.execute("CREATE INDEX idx_catastro ON predios(CATASTRO)")
    conn.execute("CREATE INDEX idx_barrio ON predios(BARRIO_)")
    conn.execute("CREATE INDEX idx_codigo ON predios(CODIGO)")
    conn.commit()
    conn.close()
    if db_target != DB_PATH and os.path.exists(db_target):
        try:
            os.replace(db_target, DB_PATH)
            db_target = DB_PATH
        except OSError:
            pass
    size_mb = os.path.getsize(db_target) / 1024 / 1024
    print(f"SQLite: {db_target} ({size_mb:.1f} MB)")

    # Update analytics.json with real 140K stats
    analytics_path = os.path.join(OUT_DIR, "analytics.json")
    analytics = {}
    if os.path.exists(analytics_path):
        with open(analytics_path, encoding="utf-8") as f:
            analytics = json.load(f)

    analytics["kpis"]["predios"] = len(df)
    analytics["estrato"] = (
        df["ESTRATO"].value_counts().sort_index()
        .reset_index().rename(columns={"index": "estrato", "ESTRATO": "estrato", "count": "cantidad"})
        .to_dict("records")
    )
    # fix column names from value_counts
    estrato_vc = df["ESTRATO"].value_counts().sort_index()
    analytics["estrato"] = [{"estrato": int(k), "cantidad": int(v)} for k, v in estrato_vc.items()]

    analytics["uso"] = [
        {"uso": k, "cantidad": int(v)}
        for k, v in df["USO"].value_counts().head(12).items()
    ]
    analytics["equipamiento"] = [
        {"equipamiento": k or "Sin clasificar", "cantidad": int(v)}
        for k, v in df["EQUIPAMIEN"].fillna("").replace("", "Sin clasificar").value_counts().head(10).items()
    ]

    act = df["ACTIVIDAD"].str.extract(r"(REGULAR|MODERADA|INTENSA)", expand=False).dropna()
    if len(act):
        analytics["caracteristica"] = [
            {"caracteristica": k, "cantidad": int(v)}
            for k, v in act.value_counts().items()
        ]

    barrios = df.groupby("BARRIO_").size().reset_index(name="predios").sort_values("predios", ascending=False)
    analytics["barrios_ranking"] = barrios.head(20).to_dict("records")

    with open(analytics_path, "w", encoding="utf-8") as f:
        json.dump(analytics, f, ensure_ascii=False, indent=2)
    print(f"Analytics actualizados: {analytics_path}")
    print("OK")


if __name__ == "__main__":
    main()
