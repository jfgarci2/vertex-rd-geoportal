# VERTEX RD — Recruiter Summary

**Candidate:** José Fernando García Pérez  
**Target roles:** Geospatial Engineer · GIS Developer · Analytics Engineer (spatial) · Data Engineer (geo)

---

## Elevator pitch

Built an production-style **cadastral geoportal** covering **140,237 parcels** in Santo Domingo with Mapbox GL JS, FastAPI, PostGIS/SQLite, and urban zoning analytics — demonstrating end-to-end geospatial data engineering from shapefiles to interactive product.

---

## Key metrics

| | |
|---|---|
| Parcels | 140,237 |
| Vector layers | 22 → 10 Mapbox tilesets |
| API endpoints | Search, KPIs, territory stats, analytics by barrio |
| Stack | Mapbox GL JS · Turf.js · FastAPI · PostGIS · Docker |

---

## Business impact (3 bullets)

1. **Cadastral intelligence at scale** — instant parcel lookup, map highlight, and zoning context for any of 140K properties.
2. **Urban compliance** — density typologies (BM→AI) and setback rules integrated into each parcel record for planning decisions.
3. **Territorial analytics** — barrio-level dashboards for land use, road network, and public space without leaving the geoportal.

---

## Skills demonstrated

- Shapefile / geodatabase → cloud vector tiles (Mapbox)
- Web mapping (layers, popups, basemaps, spatial tools)
- SQL + Python ETL + JSON analytics models
- REST API design with graceful DB fallback
- Docker, deployment docs, English portfolio documentation

---

## Demo links

- **Repo:** https://github.com/jfgarci2/vertex-rd-geoportal  
- **Case study:** [CASE_STUDY.md](CASE_STUDY.md)  
- **Related:** [Medellín Cadastral Analytics](https://github.com/jfgarci2/medellin-cadastral-analytics) · [AMVA Environmental Permits](https://github.com/jfgarci2/amva-environmental-permits)

---

## Interview talking points

- Why vector tiles instead of GeoJSON for 140K polygons  
- How SQLite fallback keeps the demo running without PostGIS  
- Tilequery + Turf.js for nearest-facility analysis at high zoom  
- Connecting Power BI semantic model to web analytics views  
