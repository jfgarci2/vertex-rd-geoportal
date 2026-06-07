# VERTEX RD — Cadastral Geoportal 360°

**Geospatial Data Engineering · Analytics Engineering · Urban Planning GIS**

Production-style geoportal for **Distrito Nacional, Dominican Republic**: **140,237 parcels**, **22 geospatial layers**, urban density rules, setback tables, and analytics dashboards inspired by the Power BI model `VERTEX_DN_RD_V3`.

---

## Live demo

| Resource | URL |
|----------|-----|
| **Live demo (full stack)** | https://vertex-rd-geoportal.onrender.com |
| **API health** | https://vertex-rd-geoportal.onrender.com/api/health |
| **Code** | https://github.com/jfgarci2/vertex-rd-geoportal |
| **Educational PDF report** | [docs/INFORME_EDUCATIVO_COMPLETO.html](docs/INFORME_EDUCATIVO_COMPLETO.html) (Ctrl+P → Save as PDF) |
| **Portfolio** | [jfgarcia-portfolio.vercel.app](https://jfgarcia-portfolio.vercel.app/es) |

---

## Recruiter snapshot (30 seconds)

| Metric | Value |
|--------|-------|
| Parcels modeled | **140,237** |
| Vector layers | **22 shapefiles → 10 Mapbox tilesets** |
| Sub-district polygons | **253** (GeoJSON) |
| Backend | **FastAPI + PostGIS / SQLite fallback** |
| Frontend | **Mapbox GL JS 3.10, Turf.js, Chart.js** |
| Domain | Cadastral search, urban density (BM→AI), setbacks, public space analytics |

### Business impact

1. **Cadastral lookup at scale** — search and highlight any of 140K parcels with zoning context in seconds.
2. **Planning compliance** — density typologies and setback rules attached to each parcel record (Renacimiento framework).
3. **Territorial analytics** — barrio-level KPIs for land use, roads, public space, and equipment without leaving the map.

---

## What this project proves

| Role | Evidence |
|------|----------|
| **Geospatial Engineer** | Shapefile → Mapbox tilesets, Mapbox GL JS layers, Turf.js measurements, Directions API routing |
| **Analytics Engineer** | Excel/PostGIS tables → JSON/SQLite → dynamic Parcel Sheet + dashboard views |
| **Data Engineer** | ETL scripts, Docker PostGIS, 140K-row SQLite search API |
| **Urban GIS** | Parcel Sheet 360°, density typologies, setbacks, public-space indicators |

---

## Architecture

```
SOURCES (local VERTEXRD — not in git)
  SHAPEFILES/ · Excel · PostGIS · File Geodatabase
           │
           ▼
MAPBOX TILESETS (vector)          data/ (JSON + optional predios.db)
  barrios · predios · vias …       densidades · retiros · analytics …
           │
           ▼
WEB APP — FastAPI serves API + static geoportal
  Map · Parcel Sheet · Statistics · Roads · Public space
```

---

## Quick start (local)

### Prerequisites

- Python 3.11+
- Mapbox access token ([create one](https://account.mapbox.com/access-tokens/)) with **URL restrictions** for your domain

### 1. Configure secrets

```powershell
cd vertex-rd-geoportal
copy .env.example .env
# Edit .env — set MAPBOX_ACCESS_TOKEN=pk....
python scripts/generate_local_config.py
```

### 2. Export parcel database (first time only)

Requires `PREDIOS_RD.shp` under `VERTEXRD/SHAPEFILES/`:

```powershell
$env:VERTEX_ROOT = ".."
python scripts/export_predios_full.py
```

### 3. Run

```powershell
.\start.ps1
# Open http://localhost:8000  ·  API docs http://localhost:8000/docs
```

---

## Deploy (Railway / Render / Fly.io)

**Vercel** is best for static frontends only. This app is a **Python API + static files** — use **Railway** or **Render** (similar “connect GitHub → deploy” UX).

| Platform | Best for | Notes |
|----------|----------|-------|
| **Railway** | Full stack demo | Easiest GitHub connect, env vars, free tier |
| **Render** | Full stack demo | `render.yaml` included |
| **Fly.io** | Docker / global edge | `fly.toml` optional |
| **Vercel** | Portfolio landing pages | Not ideal for FastAPI + SQLite |
| **GitHub Pages** | Static mirror | Map works; API needs separate host |

Full guide: **[docs/DEPLOY.md](docs/DEPLOY.md)**

Required env vars on Railway/Render:

```
MAPBOX_ACCESS_TOKEN=pk.your_token
```

Optional: `DATABASE_URL` for PostGIS. Without it, the app uses `data/predios.db` (generate locally before deploy or attach via volume).

---

## Publish to GitHub

```powershell
cd vertex-rd-geoportal
git add .
git commit -m "feat: VERTEX RD geoportal — Mapbox GL JS, FastAPI, analytics"
git branch -M main
git remote add origin https://github.com/jfgarci2/vertex-rd-geoportal.git
git push -u origin main
```

Then connect the repo to Railway or Render (see DEPLOY.md).

---

## Stack

Mapbox GL JS · Turf.js · Chart.js · FastAPI · PostGIS · SQLite · Docker · Power BI (source dashboards)

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Railway, Render, Fly.io, GitHub Pages |
| [docs/CASE_STUDY.md](docs/CASE_STUDY.md) | One-page portfolio narrative (English) |
| [docs/RECRUITER_SUMMARY.md](docs/RECRUITER_SUMMARY.md) | Bullet summary for applications |
| [docs/MANUAL_EDUCATIVO.md](docs/MANUAL_EDUCATIVO.md) | Step-by-step guide (Spanish) |
| [README.es.md](README.es.md) | README in Spanish |

---

## Author

**José Fernando García Pérez**  
Senior Geospatial Data Engineer & Analytics Engineer · Dominican Republic / Colombia

- Portfolio: [jfgarcia-portfolio.vercel.app](https://jfgarcia-portfolio.vercel.app/es)
- GitHub: [@jfgarci2](https://github.com/jfgarci2)

## Related projects

| Project | Links |
|---------|-------|
| Medellín Cadastral Analytics | [Demo](https://jfgarci2.github.io/medellin-cadastral-analytics/) · [Repo](https://github.com/jfgarci2/medellin-cadastral-analytics) |
| AMVA Environmental Permits | [Dashboard](https://dashboard-lake-eight-41.vercel.app) · [Repo](https://github.com/jfgarci2/amva-environmental-permits) |
