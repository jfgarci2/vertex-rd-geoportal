"""Fallback SQLite cuando PostGIS no está disponible."""
import json
import os
import sqlite3
from collections import Counter
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "predios.db"
DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def db_available() -> bool:
    return DB_PATH.exists()


def _conn():
    return sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row


def get_conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def count_predios() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM predios").fetchone()[0]


def search(q: str, limit: int = 20):
    q = q.strip()
    if not q:
        return []
    parts = [p for p in q.split() if p]
    with get_conn() as conn:
        if len(parts) > 1:
            barrio_pat = f"%{parts[0]}%"
            rest_pat = f"%{' '.join(parts[1:])}%"
            rows = conn.execute(
                """SELECT CATASTRO, CODIGO, BARRIO_, SUB_BARRIO, USO, ACTIVIDAD, ESTRATO, AREAPREDIO,
                          ID_DENSIDA, ID_RETIROS, NOMBRE_UT
                   FROM predios
                   WHERE (BARRIO_ LIKE ? OR SUB_BARRIO LIKE ?)
                     AND (USO LIKE ? OR ACTIVIDAD LIKE ? OR NOMBRE_UT LIKE ? OR CATASTRO LIKE ? OR CODIGO LIKE ?)
                   ORDER BY AREAPREDIO DESC
                   LIMIT ?""",
                (barrio_pat, barrio_pat, rest_pat, rest_pat, rest_pat, rest_pat, rest_pat, limit),
            ).fetchall()
        else:
            pat = f"%{q}%"
            rows = conn.execute(
                """SELECT CATASTRO, CODIGO, BARRIO_, SUB_BARRIO, USO, ACTIVIDAD, ESTRATO, AREAPREDIO,
                          ID_DENSIDA, ID_RETIROS, NOMBRE_UT
                   FROM predios
                   WHERE CATASTRO LIKE ? OR CODIGO LIKE ? OR BARRIO_ LIKE ? OR SUB_BARRIO LIKE ?
                        OR USO LIKE ? OR ACTIVIDAD LIKE ? OR NOMBRE_UT LIKE ?
                   ORDER BY
                     CASE WHEN BARRIO_ LIKE ? THEN 0 WHEN SUB_BARRIO LIKE ? THEN 1 WHEN USO LIKE ? THEN 2 ELSE 3 END,
                     AREAPREDIO DESC
                   LIMIT ?""",
                (pat, pat, pat, pat, pat, pat, pat, pat, pat, pat, limit),
            ).fetchall()
    return [_search_row(r) for r in rows]


def _browse_where(barrio=None, sub_barrio=None, uso=None, q=None):
    clauses, params = [], []
    if barrio:
        clauses.append("BARRIO_ = ?")
        params.append(barrio)
    if sub_barrio:
        clauses.append("SUB_BARRIO = ?")
        params.append(sub_barrio)
    if uso:
        clauses.append("USO LIKE ?")
        params.append(f"%{uso}%")
    if q:
        pat = f"%{q}%"
        clauses.append("(USO LIKE ? OR ACTIVIDAD LIKE ? OR NOMBRE_UT LIKE ? OR CODIGO LIKE ?)")
        params.extend([pat, pat, pat, pat])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


def browse_count(barrio: str = None, sub_barrio: str = None, uso: str = None, q: str = None) -> int:
    where, params = _browse_where(barrio, sub_barrio, uso, q)
    if not where:
        return count_predios()
    with get_conn() as conn:
        return conn.execute(f"SELECT COUNT(*) FROM predios {where}", params).fetchone()[0]


def browse(barrio: str = None, sub_barrio: str = None, uso: str = None, q: str = None, limit: int = 40):
    where, params = _browse_where(barrio, sub_barrio, uso, q)
    total = browse_count(barrio, sub_barrio, uso, q) if where else count_predios()
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT CATASTRO, CODIGO, BARRIO_, SUB_BARRIO, USO, ACTIVIDAD, ESTRATO, AREAPREDIO,
                       ID_DENSIDA, ID_RETIROS, NOMBRE_UT
                FROM predios {where or ''}
                ORDER BY AREAPREDIO DESC LIMIT ?""",
            params,
        ).fetchall()
    return {
        "total": total,
        "limit": limit,
        "showing": len(rows),
        "items": [_search_row(r) for r in rows],
    }


def territory_stats(barrio: str = None, sub_barrio: str = None):
    if not barrio and not sub_barrio:
        return None
    where, params = _browse_where(barrio, sub_barrio)
    with get_conn() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM predios {where}", params).fetchone()[0]
        subs = conn.execute(
            f"SELECT COUNT(DISTINCT SUB_BARRIO) FROM predios {where} AND SUB_BARRIO IS NOT NULL AND SUB_BARRIO != ''",
            params,
        ).fetchone()[0]
        usos = conn.execute(
            f"""SELECT USO, COUNT(*) AS n FROM predios {where}
                AND USO IS NOT NULL AND USO != '' GROUP BY USO ORDER BY n DESC LIMIT 5""",
            params,
        ).fetchall()
        area = conn.execute(
            f"SELECT AVG(AREAPREDIO), SUM(AREAPREDIO) FROM predios {where}", params
        ).fetchone()
        manzanas = conn.execute(
            f"""SELECT COUNT(DISTINCT POLIGONO) FROM predios {where}
                AND POLIGONO IS NOT NULL AND POLIGONO != ''""",
            params,
        ).fetchone()[0]
    uso_list = [{"uso": r[0], "cantidad": int(r[1])} for r in usos]
    residencial = sum(u["cantidad"] for u in uso_list if "resid" in u["uso"].lower())
    comercial = sum(u["cantidad"] for u in uso_list if "comer" in u["uso"].lower() or u["uso"] == "Comercial")
    return {
        "barrio": barrio,
        "sub_barrio": sub_barrio,
        "label": sub_barrio or barrio,
        "predios": total,
        "manzanas": manzanas,
        "sub_barrios": subs,
        "area_promedio_m2": round(float(area[0]), 1) if area and area[0] else None,
        "area_total_m2": round(float(area[1]), 1) if area and area[1] else None,
        "usos": uso_list,
        "residencial": residencial,
        "comercial": comercial,
    }


def list_barrios():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT BARRIO_ AS nombre, COUNT(*) AS predios,
                      MIN(CENTROID_LNG) AS min_lng, MAX(CENTROID_LNG) AS max_lng,
                      MIN(CENTROID_LAT) AS min_lat, MAX(CENTROID_LAT) AS max_lat,
                      AVG(CENTROID_LNG) AS center_lng, AVG(CENTROID_LAT) AS center_lat
               FROM predios WHERE BARRIO_ IS NOT NULL AND BARRIO_ != ''
               GROUP BY BARRIO_ ORDER BY BARRIO_"""
        ).fetchall()
    return [_territory_row(r) for r in rows]


def list_sub_barrios(barrio: str = None):
    with get_conn() as conn:
        if barrio:
            rows = conn.execute(
                """SELECT SUB_BARRIO AS nombre, BARRIO_ AS barrio, COUNT(*) AS predios,
                          MIN(CENTROID_LNG) AS min_lng, MAX(CENTROID_LNG) AS max_lng,
                          MIN(CENTROID_LAT) AS min_lat, MAX(CENTROID_LAT) AS max_lat,
                          AVG(CENTROID_LNG) AS center_lng, AVG(CENTROID_LAT) AS center_lat
                   FROM predios WHERE BARRIO_ = ? AND SUB_BARRIO IS NOT NULL AND SUB_BARRIO != ''
                   GROUP BY SUB_BARRIO ORDER BY SUB_BARRIO""",
                (barrio,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT SUB_BARRIO AS nombre, BARRIO_ AS barrio, COUNT(*) AS predios,
                          MIN(CENTROID_LNG) AS min_lng, MAX(CENTROID_LNG) AS max_lng,
                          MIN(CENTROID_LAT) AS min_lat, MAX(CENTROID_LAT) AS max_lat,
                          AVG(CENTROID_LNG) AS center_lng, AVG(CENTROID_LAT) AS center_lat
                   FROM predios WHERE SUB_BARRIO IS NOT NULL AND SUB_BARRIO != ''
                   GROUP BY SUB_BARRIO, BARRIO_ ORDER BY BARRIO_, SUB_BARRIO"""
            ).fetchall()
    return [_territory_row(r) for r in rows]


def territory_bounds(barrio: str = None, sub_barrio: str = None):
    clauses, params = [], []
    if barrio:
        clauses.append("BARRIO_ = ?")
        params.append(barrio)
    if sub_barrio:
        clauses.append("SUB_BARRIO = ?")
        params.append(sub_barrio)
    if not clauses:
        return None
    where = " AND ".join(clauses)
    with get_conn() as conn:
        row = conn.execute(
            f"""SELECT MIN(CENTROID_LNG) AS min_lng, MAX(CENTROID_LNG) AS max_lng,
                       MIN(CENTROID_LAT) AS min_lat, MAX(CENTROID_LAT) AS max_lat,
                       AVG(CENTROID_LNG) AS center_lng, AVG(CENTROID_LAT) AS center_lat,
                       COUNT(*) AS predios
                FROM predios WHERE {where}""",
            params,
        ).fetchone()
    if not row or not row["predios"]:
        return None
    return _territory_row(row)


def _search_row(r):
    area = r["AREAPREDIO"]
    return {
        "catastro": r["CATASTRO"],
        "codigo": r["CODIGO"],
        "barrio": r["BARRIO_"],
        "sub_barrio": r["SUB_BARRIO"],
        "uso": r["USO"],
        "actividad": r["ACTIVIDAD"],
        "nombre_ut": r["NOMBRE_UT"],
        "estrato": r["ESTRATO"],
        "areapredio": area,
        "id_densidades": r["ID_DENSIDA"],
        "id_retiros": r["ID_RETIROS"],
        "label": _predio_label(r),
    }


def _predio_label(r):
    parts = [r["BARRIO_"] or "", r["USO"] or r["ACTIVIDAD"] or ""]
    title = " · ".join(p for p in parts if p)
    area = r["AREAPREDIO"]
    area_txt = f"{float(area):,.0f} m²" if area else ""
    codigo = r["CODIGO"] or (r["CATASTRO"] or "")[-8:]
    return {"title": title or r["CATASTRO"], "subtitle": f"Ref. {codigo} · {area_txt}".strip(" ·")}


def _territory_row(r):
    d = dict(r)
    for k in ("min_lng", "max_lng", "min_lat", "max_lat", "center_lng", "center_lat"):
        if d.get(k) is not None:
            try:
                d[k] = float(d[k])
            except (TypeError, ValueError):
                pass
    if d.get("min_lng") is not None:
        d["bounds"] = {
            "min_lng": d["min_lng"], "max_lng": d["max_lng"],
            "min_lat": d["min_lat"], "max_lat": d["max_lat"],
        }
        d["center"] = {"lng": d.get("center_lng"), "lat": d.get("center_lat")}
    return d


def get_predio(catastro: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM predios WHERE CATASTRO = ?", (catastro,)).fetchone()
    if not row:
        return None
    p = dict(row)
    id_dens = p.get("ID_DENSIDA") or p.get("TIPOS")
    id_ret = p.get("ID_RETIROS")

    dens = _load_json_match("densidades.json", "ID_DENSIDADES", id_dens)
    retiros = _load_json_filter("retiros.json", "ID_RETIROS", id_ret)
    ren = _load_json_filter("densidades_renacimiento.json", "ID_DENSIDADES", id_dens)

    centroid = None
    lng, lat = p.get("CENTROID_LNG"), p.get("CENTROID_LAT")
    if lng and lat:
        try:
            centroid = {"lng": float(lng), "lat": float(lat)}
        except (TypeError, ValueError):
            pass

    return {
        "predio": _normalize_predio(p),
        "densidad": dens,
        "retiros": retiros,
        "renacimiento": ren,
        "centroid": centroid,
    }


def _normalize_predio(p):
    return {
        "catastro": p.get("CATASTRO"),
        "codigo": p.get("CODIGO"),
        "barrio": p.get("BARRIO_"),
        "sub_barrio": p.get("SUB_BARRIO"),
        "poligono": p.get("POLIGONO"),
        "uso": p.get("USO"),
        "actividad": p.get("ACTIVIDAD"),
        "estado_des": p.get("ESTADO_DES"),
        "ut": p.get("UT"),
        "nombre_ut": p.get("NOMBRE_UT"),
        "areapredio": p.get("AREAPREDIO"),
        "estrato": p.get("ESTRATO"),
        "categoria": p.get("CATEGORIA"),
        "tipos": p.get("TIPOS"),
        "id_densidades": p.get("ID_DENSIDA"),
        "id_retiros": p.get("ID_RETIROS"),
        "equipamien": p.get("EQUIPAMIEN"),
        "distrito": p.get("DISTRITO"),
    }


def _load_json_match(filename, key, value):
    if not value:
        return None
    path = DATA_DIR / filename
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for item in data:
        if item.get(key) == value:
            return item
    return None


def _load_json_filter(filename, key, value):
    if not value:
        return []
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [item for item in data if item.get(key) == value]


def analytics_estrato(barrio: str = None):
    where, params = _browse_where(barrio=barrio)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT ESTRATO AS estrato, COUNT(*) AS cantidad FROM predios {where} GROUP BY ESTRATO ORDER BY ESTRATO",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def analytics_uso(barrio: str = None):
    where, params = _browse_where(barrio=barrio)
    extra = " AND USO IS NOT NULL AND USO != ''" if where else " WHERE USO IS NOT NULL AND USO != ''"
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT USO AS uso, COUNT(*) AS cantidad FROM predios {where}{extra}
                GROUP BY USO ORDER BY cantidad DESC LIMIT 12""",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def analytics_equipamiento(barrio: str = None):
    where, params = _browse_where(barrio=barrio)
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT CASE WHEN EQUIPAMIEN IS NULL OR EQUIPAMIEN = '' THEN 'Sin clasificar'
                            ELSE EQUIPAMIEN END AS equipamiento,
                       COUNT(*) AS cantidad
                FROM predios {where}
                GROUP BY equipamiento ORDER BY cantidad DESC LIMIT 10""",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def analytics_caracteristica(barrio: str = None):
    where, params = _browse_where(barrio=barrio)
    extra = " AND ACTIVIDAD IS NOT NULL AND ACTIVIDAD != ''" if where else " WHERE ACTIVIDAD IS NOT NULL AND ACTIVIDAD != ''"
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT ACTIVIDAD FROM predios {where}{extra}",
            params,
        ).fetchall()
    counts = {"REGULAR": 0, "MODERADA": 0, "INTENSA": 0}
    for r in rows:
        act = (r[0] or "").upper()
        for key in counts:
            if key in act:
                counts[key] += 1
                break
    return [{"caracteristica": k, "cantidad": v} for k, v in counts.items() if v > 0]


def analytics_dashboard(barrio: str = None):
    if not barrio:
        with get_conn() as conn:
            predios = conn.execute("SELECT COUNT(*) FROM predios").fetchone()[0]
            barrios_n = conn.execute(
                "SELECT COUNT(DISTINCT BARRIO_) FROM predios WHERE BARRIO_ IS NOT NULL AND BARRIO_ != ''"
            ).fetchone()[0]
            manzanas = conn.execute(
                "SELECT COUNT(DISTINCT POLIGONO) FROM predios WHERE POLIGONO IS NOT NULL AND POLIGONO != ''"
            ).fetchone()[0]
            subs = conn.execute(
                "SELECT COUNT(DISTINCT SUB_BARRIO) FROM predios WHERE SUB_BARRIO IS NOT NULL AND SUB_BARRIO != ''"
            ).fetchone()[0]
        return {
            "barrio": None,
            "label": "Distrito Nacional",
            "kpis": {
                "predios": predios,
                "barrios": barrios_n,
                "manzanas": manzanas,
                "sub_barrios": subs,
            },
            "estrato": analytics_estrato(),
            "uso": analytics_uso(),
            "equipamiento": analytics_equipamiento(),
            "caracteristica": analytics_caracteristica(),
        }
    where, params = _browse_where(barrio=barrio)
    with get_conn() as conn:
        predios = conn.execute(f"SELECT COUNT(*) FROM predios {where}", params).fetchone()[0]
        manzanas = conn.execute(
            f"""SELECT COUNT(DISTINCT POLIGONO) FROM predios {where}
                AND POLIGONO IS NOT NULL AND POLIGONO != ''""",
            params,
        ).fetchone()[0]
        subs = conn.execute(
            f"""SELECT COUNT(DISTINCT SUB_BARRIO) FROM predios {where}
                AND SUB_BARRIO IS NOT NULL AND SUB_BARRIO != ''""",
            params,
        ).fetchone()[0]
    return {
        "barrio": barrio,
        "label": barrio,
        "kpis": {
            "predios": predios,
            "barrios": 1,
            "manzanas": manzanas,
            "sub_barrios": subs,
        },
        "estrato": analytics_estrato(barrio),
        "uso": analytics_uso(barrio),
        "equipamiento": analytics_equipamiento(barrio),
        "caracteristica": analytics_caracteristica(barrio),
    }


def _load_vias_barrios():
    path = DATA_DIR / "vias_por_barrio.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def analytics_vias(barrio: str = None):
    rows = _load_vias_barrios()
    if not rows:
        return {
            "barrio": barrio,
            "label": barrio or "Distrito Nacional",
            "kpis": {"vias": 0, "longitud_m": 0, "longitud_km": 0},
            "items": [],
        }

    def _match(name):
        if not name:
            return None
        key = name.strip().upper()
        for r in rows:
            if r["barrio"].strip().upper() == key:
                return r
        for r in rows:
            if key in r["barrio"].strip().upper():
                return r
        return None

    if barrio:
        r = _match(barrio)
        if not r:
            return {
                "barrio": barrio,
                "label": barrio,
                "kpis": {"vias": 0, "longitud_m": 0, "longitud_km": 0},
                "items": [],
            }
        return {
            "barrio": r["barrio"],
            "label": r["barrio"],
            "kpis": {
                "vias": r["vias"],
                "longitud_m": r["longitud_m"],
                "longitud_km": r["longitud_km"],
            },
            "items": [r],
        }

    total_vias = sum(int(r["vias"]) for r in rows)
    total_m = sum(float(r["longitud_m"]) for r in rows)
    return {
        "barrio": None,
        "label": "Distrito Nacional",
        "kpis": {
            "vias": total_vias,
            "longitud_m": round(total_m, 2),
            "longitud_km": round(total_m / 1000, 2),
        },
        "items": rows[:15],
    }


def _load_espacios_barrios():
    path = DATA_DIR / "espacios_por_barrio.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def analytics_espacios(barrio: str = None):
    rows = _load_espacios_barrios()
    if not rows:
        return {
            "barrio": barrio,
            "label": barrio or "Distrito Nacional",
            "kpis": {"parques": 0, "espacios_abiertos": 0, "barrios": 70},
            "parques_categoria": [],
            "espacios_clasificacion": [],
        }

    def _match(name):
        if not name:
            return None
        key = name.strip().upper()
        for r in rows:
            if r["barrio"].strip().upper() == key:
                return r
        for r in rows:
            if key in r["barrio"].strip().upper():
                return r
        return None

    if barrio:
        r = _match(barrio)
        if not r:
            return {
                "barrio": barrio,
                "label": barrio,
                "kpis": {"parques": 0, "espacios_abiertos": 0, "barrios": 1},
                "parques_categoria": [],
                "espacios_clasificacion": [],
            }
        return {
            "barrio": r["barrio"],
            "label": r["barrio"],
            "kpis": {
                "parques": r["parques"],
                "espacios_abiertos": r["espacios_abiertos"],
                "barrios": 1,
            },
            "parques_categoria": r.get("parques_categoria", []),
            "espacios_clasificacion": r.get("espacios_clasificacion", []),
        }

    total_parques = sum(int(r["parques"]) for r in rows)
    total_esp = sum(int(r["espacios_abiertos"]) for r in rows)
    cat = Counter()
    cls = Counter()
    for r in rows:
        for item in r.get("parques_categoria", []):
            cat[item["categoria"]] += int(item["cantidad"])
        for item in r.get("espacios_clasificacion", []):
            cls[item["clasificacion"]] += int(item["cantidad"])

    return {
        "barrio": None,
        "label": "Distrito Nacional",
        "kpis": {
            "parques": total_parques,
            "espacios_abiertos": total_esp,
            "barrios": len(rows),
        },
        "parques_categoria": [
            {"categoria": k, "cantidad": v}
            for k, v in sorted(cat.items(), key=lambda x: -x[1])
        ],
        "espacios_clasificacion": [
            {"clasificacion": k, "cantidad": v}
            for k, v in sorted(cls.items(), key=lambda x: -x[1])
        ],
    }
