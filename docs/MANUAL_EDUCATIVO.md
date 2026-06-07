# Manual Educativo — VERTEX RD Geoportal

Guía paso a paso para **entender, replicar y presentar** este proyecto en tu portafolio internacional.

---

## 1. ¿Qué es VERTEX RD?

VERTEX RD es un **sistema de información geográfica (SIG) + analítica urbana** para el Distrito Nacional de Santo Domingo. Combina:

1. **Datos catastrales** (140,237 predios)
2. **Normativa urbanística** (densidades, retiros, usos permitidos)
3. **Capas ambientales** (ríos, áreas protegidas, parques)
4. **Infraestructura** (12,429 vías, metro, troncales)

Tú ya construiste la base en tres herramientas:

| Herramienta | Qué hiciste | Archivo clave |
|-------------|-------------|---------------|
| **ArcGIS** | Shapefiles + Geodatabase | `SHAPEFILES/`, `VERTEX_RD.gdb` |
| **Mapbox** | Publicación de tilesets | `html59.html` |
| **Power BI** | Dashboard ejecutivo | `VERTEX_DN_RD_V3.pbix` |

Este geoportal **une las tres** en una aplicación web profesional.

---

## 2. Estructura de carpetas VERTEXRD

```
VERTEXRD/
├── SHAPEFILES/          ← 22 capas .shp (fuente GIS)
├── BASES DE DATOS/      ← Excel tabular (predios, densidades, retiros)
├── MAPBOX GS JL/        ← Tu código original (html57–59)
├── POWER BI/            ← Tablero VERTEX_DN_RD_V3.pbix
├── LOGO/                ← Logo-VertexRD.jpeg
├── LAYERS/              ← Estilos .lyr de ArcGIS
└── vertex-rd-geoportal/ ← Este proyecto publicable (NUEVO)
```

---

## 3. Flujo de datos (cómo se conecta todo)

### Paso A: Shapefile → Mapbox Tileset

```
PREDIOS_RD.shp  →  Mapbox Studio Upload  →  mapbox://jfgarci2.1lozfrry
```

En `html59.html` cargas el tileset así:

```javascript
map.addSource('predios', {
  type: 'vector',
  url: 'mapbox://jfgarci2.1lozfrry'
});
map.addLayer({
  id: 'predios-layer',
  type: 'fill',
  source: 'predios',
  'source-layer': 'PREDIOS_RD_V2-9pclyn'
});
```

**Concepto clave:** Mapbox convierte tu shapefile en **teselas vectoriales** que el navegador renderiza rápido, incluso con 140K polígonos.

### Paso B: Excel → JSON → Ficha Predial

```
Tbl_Densidades_.xlsx  →  scripts/export_data.py  →  data/densidades.json
PREDIOS_RD.xlsx       →  scripts/export_data.py  →  data/predios_lookup.json
```

Cuando el usuario busca un código catastro:

1. Se busca en `predios_lookup.json`
2. Se obtiene `ID_DENSIDADES` (ej: "AI") y `ID_RETIROS` (ej: "R3")
3. Se cruzan con `densidades.json` y `retiros.json`
4. Se muestran las tarjetas de la Ficha Predial 360°

**Esto replica la lógica DAX de Power BI en JavaScript.**

### Paso C: Power BI → Charts web

Las visualizaciones de `ESTADISTICAS PREDIALES` (estrato, uso, equipamiento) se generan con **Chart.js** usando `data/analytics.json`.

---

## 4. Anatomía del código html59 (tu base)

Tu `html59.html` ya tenía:

| Funcionalidad | Tecnología |
|---------------|------------|
| Mapa satelital | Mapbox GL JS 3.10 |
| 10 capas vectoriales | Mapbox Tilesets |
| Búsqueda de direcciones | Mapbox Geocoder |
| Popups al hacer clic | `map.on('click', 'capa')` |
| Distancias a parques/metro | Turf.js `turf.distance()` |
| Rutas en auto | Mapbox Directions API |
| Medición de distancias | Turf.js `turf.length()` |
| Toggle de capas | `setLayoutProperty('visibility')` |

**Lo que mejoramos en el geoportal:**

- UI oscura tipo Power BI (sidebar, KPI cards, ficha predial)
- 9 vistas de navegación (Presentación, Espacios Públicos, Ficha, etc.)
- Búsqueda por código catastro
- Cruce automático predio → densidades → retiros
- Gráficos Chart.js
- Código modular (`js/config.js`, `map-core.js`, etc.)
- Documentación para portafolio

---

## 5. Tablas de datos explicadas

### PREDIOS_RD (capa principal)

Campos clave que usa el geoportal:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `CATASTRO` | Código único del predio | `100640579000000-0061` |
| `BARRIO_` | Nombre del barrio | `MIRAFLORES` |
| `SUB_BARRIO` | Sub-barrio | `MIRAFLORES` |
| `USO` | Uso del suelo | `Comercial`, `Residencial` |
| `ESTRATO` | Estrato socioeconómico | 0–5 |
| `AREAPREDIO` | Área en m² | `3072.22` |
| `ID_DENSIDADES` | Clave a tabla de densidades | `AI`, `BM`, `RAMC` |
| `ID_RETIROS` | Clave a tabla de retiros | `R1`, `R2`, `R3` |

### Tbl_Densidades_ (9 tipologías)

| ID | Categoría | Altura máx | Usos |
|----|-----------|------------|------|
| BM | Baja Media | 2 niveles / 8m | Residencial unifamiliar |
| AR | Alta Regular | 25 niveles / 89.5m | Multifamiliar y comercial |
| AI | Alta Intensiva | 40 niveles / 142m | Multifamiliar y comercial |

### Tbl_Densidades_Renacimiento (Plan Renacimiento)

| ID | Simbología | Densidad hab/ha | Niveles |
|----|------------|-----------------|---------|
| RAMC | Amarillo muy claro | 350 | 3 |
| RN | Naranja | 880 | 7 |
| RMO | Marrón oscuro | 1200 | 11 |

### Tbl_Retiros_Linderos_ (5 rangos)

| ID | Densidad | Niveles | Retiro frontal |
|----|----------|---------|----------------|
| R1 | Baja | 1–3 | 3.0 m |
| R2 | Media | 4–9 | 5.0 m |
| R3 | Alta | 10–40 | 7.0–12.0 m |

---

## 6. Cómo replicar el proyecto desde cero

### Requisitos

- ArcGIS o QGIS (para shapefiles)
- Cuenta Mapbox (token + tilesets)
- Python 3.11+ con pandas
- Navegador moderno

### Pasos

1. **Preparar shapefiles** en WGS84 (EPSG:4326)
2. **Subir a Mapbox Studio** → crear tilesets → copiar URLs
3. **Actualizar** `js/config.js` con tus tileset URLs
4. **Exportar Excel a JSON**: `python scripts/export_data.py`
5. **Servir localmente**: `python -m http.server 8080`
6. **Publicar**: push a GitHub → activar Pages

---

## 7. Cómo presentar en tu portafolio

### Para reclutadores GIS

> "Construí un geoportal con 22 capas vectoriales del Distrito Nacional, 140K predios en Mapbox, mediciones espaciales con Turf.js y rutas con Directions API."

### Para reclutadores Analytics Engineer

> "Integré tablas normativas de densidad y retiros con datos catastrales mediante un pipeline Excel→JSON, replicando la lógica de un dashboard Power BI en una SPA web."

### Para reclutadores internacionales

Enlaces que debes incluir:

1. Demo live: `https://jfgarci2.github.io/vertex-rd-geoportal/`
2. Repositorio: `https://github.com/jfgarci2/vertex-rd-geoportal`
3. Informe PDF: `docs/INFORME_PORTFOLIO_RECLUTADOR.html` → Ctrl+P
4. Portafolio: `https://jfgarcia-portfolio.vercel.app/es`
5. Proyecto relacionado: [Medellín Cadastral Analytics](https://jfgarci2.github.io/medellin-cadastral-analytics/)

---

## 8. Próximos pasos recomendados

| Mejora | Impacto en portafolio |
|--------|----------------------|
| Backend PostGIS + API REST | Demuestra full-stack GIS |
| dbt para transformar tablas Excel | Analytics Engineering formal |
| Exportar predios_lookup completo (140K) | Búsqueda catastral real |
| Capa SUB_BARRIOS en Mapbox | Mapa coroplético como Power BI |
| Tests automatizados (Playwright) | DevOps / QA |

---

## 9. Glosario

| Término | Significado |
|---------|-------------|
| **Tileset** | Conjunto de teselas vectoriales en Mapbox |
| **Ficha Predial** | Hoja técnica con todos los atributos de un predio |
| **Retiro** | Distancia mínima entre edificación y lindero |
| **Densidad neta** | Habitantes por hectárea permitidos |
| **Renacimiento** | Plan de revitalización urbana de Santo Domingo |
| **POT** | Plan de Ordenamiento Territorial |

---

*Manual creado como parte del proyecto VERTEX RD — José Fernando García Pérez*
