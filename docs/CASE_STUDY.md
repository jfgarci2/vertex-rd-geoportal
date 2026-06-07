# Case Study: VERTEX RD Cadastral Geoportal

**Author:** José Fernando García Pérez  
**Role demonstrated:** Geospatial Data Engineer · Analytics Engineer  
**Location:** Distrito Nacional, Dominican Republic  

---

## Problem

Urban planners and cadastral analysts in Santo Domingo need to explore **140,000+ parcels**, zoning density rules, setbacks, and territorial KPIs in one place — not scattered across shapefiles, Excel tables, and desktop GIS sessions.

## Solution

Built **VERTEX RD**, a web geoportal that combines:

- **Interactive map** (Mapbox GL JS) with 10 vector tilesets (parcels, barrios, roads, metro, parks, rivers, SINAP, etc.)
- **Parcel Sheet 360°** — cadastral attributes + density typology + setback rules per parcel
- **Analytics views** — land use, equipment, roads, and public space by barrio
- **Spatial tools** — nearest POI distances, routing, measurement
- **Search API** — FastAPI over SQLite/PostGIS for 140K parcel lookup

## Data pipeline

```
22 shapefiles + Excel zoning tables
        │
        ├─► Mapbox Upload API → vector tilesets (map rendering)
        ├─► Python ETL → JSON (densities, setbacks, analytics aggregates)
        └─► export_predios_full.py → SQLite (140,237 rows + centroids)
                │
                ▼
        FastAPI (/api/predios/search, /api/analytics/*)
                │
                ▼
        Mapbox GL JS geoportal (single-page app)
```

## Technical highlights

| Layer | Technology | Why |
|-------|------------|-----|
| Map | Mapbox GL JS 3.10 | GPU rendering, 140K parcels as vector tiles |
| Analysis | Turf.js | Client-side distance, bbox, nearest point |
| API | FastAPI + SQLite/PostGIS | Sub-second parcel search at scale |
| Analytics | Pre-aggregated JSON + SQL | Barrio filters without heavy OLAP stack |
| Deploy | Docker / Railway / Render | One service serves API + static UI |

## Scale & quality

- **140,237** parcel records indexed for text search  
- **253** sub-barrio polygons (GeoJSON overlay)  
- **22** source layers consolidated into production tilesets  
- Graceful **SQLite fallback** when PostGIS is unavailable (local dev & cloud demo)  
- **Basemap switcher** — satellite, streets, hybrid  

## Outcomes (portfolio narrative)

1. Reduced time to answer “what can be built on this parcel?” from multi-tool GIS workflow to **one click on the map**.
2. Enabled **territory-first analytics** — filter any dashboard by barrio without re-exporting shapefiles.
3. Delivered a **recruiter-ready demo**: public URL, English docs, architecture diagram, and measurable data volume.

## Links

- Repository: https://github.com/jfgarci2/vertex-rd-geoportal  
- Portfolio: https://jfgarcia-portfolio.vercel.app/es  

---

*Copy this page into LinkedIn “Featured”, job applications, or export to PDF (Ctrl+P in browser).*
