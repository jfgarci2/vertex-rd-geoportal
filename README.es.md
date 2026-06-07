# VERTEX RD — Geoportal Catastral 360°

Versión en español. **Documentación principal en inglés:** [README.md](README.md) (recomendado para reclutadores internacionales).

Geoportal avanzado para el **Distrito Nacional, República Dominicana**: **140,237 predios**, **22 capas geoespaciales**, normativa de densidades, retiros urbanísticos y tableros analíticos.

## Demo

| Recurso | URL |
|---------|-----|
| GitHub Pages (estático) | https://jfgarci2.github.io/vertex-rd-geoportal/ |
| Despliegue completo | Railway / Render — ver [docs/DEPLOY.md](docs/DEPLOY.md) |
| Portafolio | [jfgarcia-portfolio.vercel.app](https://jfgarcia-portfolio.vercel.app/es) |

## Ejecutar localmente

```powershell
copy .env.example .env
# Editar MAPBOX_ACCESS_TOKEN
python scripts/generate_local_config.py
.\start.ps1
```

Abrir http://localhost:8000

## Documentación

- [DEPLOY.md](docs/DEPLOY.md) — Publicar en GitHub, Railway, Render
- [CASE_STUDY.md](docs/CASE_STUDY.md) — Caso de estudio (inglés)
- [MANUAL_EDUCATIVO.md](docs/MANUAL_EDUCATIVO.md) — Guía educativa
