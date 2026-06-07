#!/usr/bin/env python3
"""Carga PREDIOS_RD.shp y tablas normativas a PostGIS."""
import json
import os
import sys

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text

ROOT = os.environ.get("VERTEX_ROOT", os.path.join(os.path.dirname(__file__), "..", ".."))
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://vertex:vertex123@localhost:5432/vertex_rd",
)


def get_engine():
    return create_engine(DATABASE_URL)


def run_schema(engine):
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, encoding="utf-8") as f:
        sql = f.read()
    with engine.begin() as conn:
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))


def load_predios(engine):
    shp = os.path.join(ROOT, "SHAPEFILES", "PREDIOS_RD.shp")
    print(f"Cargando {shp}...")
    gdf = gpd.read_file(shp)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    gdf = gdf.rename(columns={
        "BARRIO_": "barrio", "SUB_BARRIO": "sub_barrio", "ESTADO_DES": "estado_des",
        "NOMBRE_UT": "nombre_ut", "ID_DENSIDA": "id_densidades", "AREAPREDIO": "areapredio",
        "ACT_USO_CO": "act_uso_co", "CODIGO_ALT": "codigo_alt",
    })
    keep = [
        "codigo", "catastro", "codigo_alt", "act_uso_co", "uso", "estrato", "actividad",
        "estado_des", "equipamien", "areapredio", "barrio", "sub_barrio", "distrito",
        "poligono", "ut", "nombre_ut", "categoria", "tipos", "id_densidades", "id_retiros", "bp",
        "geometry",
    ]
    for c in keep:
        if c not in gdf.columns and c != "geometry":
            gdf[c] = None
    gdf = gdf[keep].copy()
    gdf["geometry"] = gdf.geometry.make_valid() if hasattr(gdf.geometry, "make_valid") else gdf.geometry

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE predios RESTART IDENTITY CASCADE"))
    gdf.to_postgis("predios", engine, if_exists="append", index=False)
    print(f"Predios cargados: {len(gdf)}")


def load_tables(engine):
    base = os.path.join(ROOT, "BASES DE DATOS", "TABLAS")
    dens = pd.read_excel(os.path.join(base, "Tbl_Densidades_.xlsx"))
    ret = pd.read_excel(os.path.join(base, "Tbl_Retiros_Linderos_.xlsx"))
    ren = pd.read_excel(os.path.join(base, "Tbl_Densidades_Renacimiento.xlsx"))

    dens_rows = []
    for _, r in dens.iterrows():
        dens_rows.append({
            "id_densidades": r["ID_DENSIDADES"],
            "categoria": r.get("CATEGORIA"),
            "tipo": r.get("TIPO"),
            "altura_max_niveles": r.get("ALTURA_MAX_NIVELES"),
            "altura_max_metros": r.get("ALTURA_MAX_METROS"),
            "usos_permitidos": r.get("USOS_PERMITIDOS"),
            "data": json.dumps(r.to_dict(), ensure_ascii=False, default=str),
        })
    pd.DataFrame(dens_rows).to_sql("densidades", engine, if_exists="replace", index=False)

    ret.to_sql("retiros", engine, if_exists="replace", index=False)
    ren.to_sql("densidades_renacimiento", engine, if_exists="replace", index=False)
    print("Tablas normativas cargadas")


def main():
    engine = get_engine()
    run_schema(engine)
    load_predios(engine)
    load_tables(engine)
    print("OK — PostGIS listo")


if __name__ == "__main__":
    main()
