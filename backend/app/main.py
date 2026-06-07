"""VERTEX RD — API PostGIS + fallback SQLite (140K predios) + geoportal estático."""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from . import sqlite_fallback as sqlite

load_dotenv()


def resolve_static_dir() -> Path:
    """Locate geoportal root (index.html) — works locally and in Docker on Render."""
    env = os.getenv("VERTEX_STATIC_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for candidate in (here.parents[2], here.parents[1], Path("/app"), here.parents[3]):
        if (candidate / "index.html").is_file():
            return candidate
    return here.parents[2]


STATIC_DIR = resolve_static_dir()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://vertex:vertex123@localhost:5432/vertex_rd",
)

app = FastAPI(
    title="VERTEX RD API",
    description="API PostGIS — 140K predios Distrito Nacional",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_engine = None
_use_sqlite = False


def get_engine():
    global _engine, _use_sqlite
    if _use_sqlite:
        return None
    if _engine is None:
        try:
            _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
            with _engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except OperationalError:
            _use_sqlite = True
            _engine = None
    return _engine


def row_to_dict(row):
    return dict(row._mapping)


@app.on_event("startup")
def startup():
    get_engine()
    index = STATIC_DIR / "index.html"
    print(f"[VERTEX] STATIC_DIR={STATIC_DIR} index_exists={index.is_file()}")


def _static_meta():
    return {
        "static_dir": str(STATIC_DIR),
        "index_exists": (STATIC_DIR / "index.html").is_file(),
        "css_exists": (STATIC_DIR / "css").is_dir(),
        "js_exists": (STATIC_DIR / "js").is_dir(),
    }


@app.get("/api/health")
def health():
    meta = _static_meta()
    engine = get_engine()
    if _use_sqlite and sqlite.db_available():
        return {"status": "ok", "backend": "sqlite", "predios": sqlite.count_predios(), **meta}
    if engine:
        try:
            with engine.connect() as conn:
                n = conn.execute(text("SELECT COUNT(*) FROM predios")).scalar()
            return {"status": "ok", "backend": "postgis", "predios": n, **meta}
        except Exception:
            pass
    if sqlite.db_available():
        return {"status": "ok", "backend": "sqlite", "predios": sqlite.count_predios(), **meta}
    return {"status": "degraded", "detail": "Sin base de datos", **meta}


@app.get("/api/kpis")
def kpis():
    engine = get_engine()
    if _use_sqlite or not engine:
        n = sqlite.count_predios()
        return {
            "predios": n, "barrios": 70, "sub_barrios": 245, "manzanas": 4287,
            "espacios_abiertos": 542, "parques_plazas": 179, "zonas_informales": 824,
            "vias": 12429, "longitud_vias_km": 1496,
        }
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM predios")).scalar()
        barrios = conn.execute(text("SELECT COUNT(DISTINCT barrio) FROM predios")).scalar()
        sub = conn.execute(text("SELECT COUNT(DISTINCT sub_barrio) FROM predios")).scalar()
    return {
        "predios": total, "barrios": barrios, "sub_barrios": sub, "manzanas": 4287,
        "espacios_abiertos": 542, "parques_plazas": 179, "zonas_informales": 824,
        "vias": 12429, "longitud_vias_km": 1496,
    }


@app.get("/api/territorios/barrios")
def territorios_barrios():
    engine = get_engine()
    if _use_sqlite or not engine:
        return sqlite.list_barrios()
    raise HTTPException(501, "Solo disponible con SQLite fallback")


@app.get("/api/territorios/sub-barrios")
def territorios_sub_barrios(barrio: str = Query(None)):
    engine = get_engine()
    if _use_sqlite or not engine:
        return sqlite.list_sub_barrios(barrio)
    raise HTTPException(501, "Solo disponible con SQLite fallback")


@app.get("/api/territorios/bounds")
def territorios_bounds(barrio: str = Query(None), sub_barrio: str = Query(None)):
    if not barrio and not sub_barrio:
        raise HTTPException(400, "Indique barrio o sub_barrio")
    engine = get_engine()
    if _use_sqlite or not engine:
        bounds = sqlite.territory_bounds(barrio, sub_barrio)
        if not bounds:
            raise HTTPException(404, "Territorio no encontrado")
        return bounds
    raise HTTPException(501, "Solo disponible con SQLite fallback")


@app.get("/api/territorios/stats")
def territorios_stats(barrio: str = Query(None), sub_barrio: str = Query(None)):
    if not barrio and not sub_barrio:
        raise HTTPException(400, "Indique barrio o sub_barrio")
    engine = get_engine()
    if _use_sqlite or not engine:
        stats = sqlite.territory_stats(barrio, sub_barrio)
        if not stats:
            raise HTTPException(404, "Territorio no encontrado")
        return stats
    raise HTTPException(501, "Solo disponible con SQLite fallback")


@app.get("/api/predios/browse")
def browse_predios(
    barrio: str = Query(None),
    sub_barrio: str = Query(None),
    uso: str = Query(None),
    q: str = Query(None),
    limit: int = Query(40, le=100),
):
    engine = get_engine()
    if _use_sqlite or not engine:
        return sqlite.browse(barrio, sub_barrio, uso, q, limit)
    raise HTTPException(501, "Solo disponible con SQLite fallback")


@app.get("/api/predios/search")
def search_predios(q: str = Query(..., min_length=2), limit: int = Query(20, le=100)):
    q = q.strip()
    engine = get_engine()
    if _use_sqlite or not engine:
        return sqlite.search(q, limit)
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT catastro, codigo, barrio, sub_barrio, uso, estrato, areapredio,
                       id_densidades, id_retiros
                FROM predios
                WHERE catastro ILIKE :pat OR codigo::text ILIKE :pat OR barrio ILIKE :pat
                ORDER BY catastro LIMIT :lim
            """),
            {"pat": f"%{q}%", "lim": limit},
        ).fetchall()
    return [row_to_dict(r) for r in rows]


@app.get("/api/predios/{catastro}")
def get_predio(catastro: str):
    engine = get_engine()
    if _use_sqlite or not engine:
        result = sqlite.get_predio(catastro)
        if not result:
            raise HTTPException(404, "Predio no encontrado")
        return result

    with engine.connect() as conn:
        predio = conn.execute(
            text("SELECT * FROM predios WHERE catastro = :c"), {"c": catastro},
        ).fetchone()
        if not predio:
            raise HTTPException(404, "Predio no encontrado")
        p = row_to_dict(predio)
        id_dens = p.get("id_densidades") or p.get("tipos")
        id_ret = p.get("id_retiros")

        dens = None
        if id_dens:
            d = conn.execute(
                text("SELECT * FROM densidades WHERE id_densidades = :id"), {"id": id_dens},
            ).fetchone()
            dens = row_to_dict(d) if d else None

        retiros = []
        if id_ret:
            rows = conn.execute(
                text("SELECT * FROM retiros WHERE \"ID_RETIROS\" = :id OR id_retiros = :id"),
                {"id": id_ret},
            ).fetchall()
            retiros = [row_to_dict(r) for r in rows]

        ren = []
        if id_dens:
            rows = conn.execute(
                text("SELECT * FROM densidades_renacimiento WHERE id_densidades = :id"),
                {"id": id_dens},
            ).fetchall()
            ren = [row_to_dict(r) for r in rows]

        centroid = conn.execute(
            text("SELECT ST_X(ST_Centroid(geom)) AS lng, ST_Y(ST_Centroid(geom)) AS lat FROM predios WHERE catastro = :c"),
            {"c": catastro},
        ).fetchone()

    result = {"predio": p, "densidad": dens, "retiros": retiros, "renacimiento": ren}
    if centroid:
        result["centroid"] = {"lng": centroid.lng, "lat": centroid.lat}
    return result


@app.get("/api/analytics/estrato")
def analytics_estrato(barrio: str = Query(None)):
    engine = get_engine()
    if _use_sqlite or not engine:
        return sqlite.analytics_estrato(barrio)
    filt = "WHERE barrio = :barrio" if barrio else ""
    params = {"barrio": barrio} if barrio else {}
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT estrato, COUNT(*) AS cantidad FROM predios {filt} GROUP BY estrato ORDER BY estrato"),
            params,
        ).fetchall()
    return [{"estrato": r.estrato, "cantidad": r.cantidad} for r in rows]


@app.get("/api/analytics/uso")
def analytics_uso(barrio: str = Query(None)):
    engine = get_engine()
    if _use_sqlite or not engine:
        return sqlite.analytics_uso(barrio)
    filt = "WHERE barrio = :barrio AND" if barrio else "WHERE"
    params = {"barrio": barrio} if barrio else {}
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT uso, COUNT(*) AS cantidad FROM predios {filt} uso IS NOT NULL AND uso != '' GROUP BY uso ORDER BY cantidad DESC LIMIT 12"),
            params,
        ).fetchall()
    return [{"uso": r.uso, "cantidad": r.cantidad} for r in rows]


@app.get("/api/analytics/equipamiento")
def analytics_equipamiento(barrio: str = Query(None)):
    if _use_sqlite or not get_engine():
        return sqlite.analytics_equipamiento(barrio)
    raise HTTPException(status_code=501, detail="Solo disponible con SQLite fallback")


@app.get("/api/analytics/caracteristica")
def analytics_caracteristica(barrio: str = Query(None)):
    if _use_sqlite or not get_engine():
        return sqlite.analytics_caracteristica(barrio)
    raise HTTPException(status_code=501, detail="Solo disponible con SQLite fallback")


@app.get("/api/analytics/vias")
def analytics_vias(barrio: str = Query(None)):
    if _use_sqlite or not get_engine():
        return sqlite.analytics_vias(barrio)
    raise HTTPException(status_code=501, detail="Solo disponible con SQLite fallback")


@app.get("/api/analytics/espacios")
def analytics_espacios(barrio: str = Query(None)):
    if _use_sqlite or not get_engine():
        return sqlite.analytics_espacios(barrio)
    raise HTTPException(status_code=501, detail="Solo disponible con SQLite fallback")


@app.get("/api/analytics/dashboard")
def analytics_dashboard(barrio: str = Query(None)):
    if _use_sqlite or not get_engine():
        return sqlite.analytics_dashboard(barrio)
    raise HTTPException(status_code=501, detail="Dashboard territorial requiere SQLite en este entorno")


@app.get("/js/config.runtime.js")
def config_runtime():
    """Inject secrets at runtime (Railway/Render). Never commit tokens to git."""
    import json
    from fastapi.responses import PlainTextResponse

    payload = {
        "mapboxToken": os.getenv("MAPBOX_ACCESS_TOKEN", ""),
        "apiBase": os.getenv("VERTEX_API_BASE", ""),
    }
    body = f"window.VERTEX_RUNTIME = {json.dumps(payload)};"
    return PlainTextResponse(body, media_type="application/javascript")


STATIC_FOLDERS = ("css", "js", "data", "assets")


def _safe_file(base: Path, rel: str) -> Path:
    target = (base / rel).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise HTTPException(status_code=404, detail="Not found")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return target


def register_static_routes() -> None:
    index = STATIC_DIR / "index.html"
    if index.is_file():

        @app.get("/", include_in_schema=False)
        def serve_index():
            return FileResponse(index, media_type="text/html")

    for folder in STATIC_FOLDERS:
        base = STATIC_DIR / folder
        if not base.is_dir():
            print(f"[VERTEX] missing folder: {base}")
            continue

        def make_handler(root: Path):
            def handler(path: str):
                return FileResponse(_safe_file(root, path))
            return handler

        app.add_api_route(
            f"/{folder}/{{path:path}}",
            make_handler(base),
            methods=["GET", "HEAD"],
            include_in_schema=False,
        )


register_static_routes()
