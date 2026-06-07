# Deployment Guide — VERTEX RD Geoportal

## Which platform?

| Platform | Like Vercel? | Use for VERTEX RD? |
|----------|--------------|-------------------|
| **Vercel** | ✅ Yes — GitHub → auto deploy | ⚠️ Static sites only. No long-running FastAPI + SQLite. |
| **Railway** | ✅ Similar UX — connect repo, set env vars | ✅ **Recommended** — runs Docker/ Python, free tier |
| **Render** | ✅ Similar UX | ✅ **Recommended** — `render.yaml` included |
| **Fly.io** | ✅ Similar, more DevOps | ✅ Good if you want global regions |
| **GitHub Pages** | Static hosting | ⚠️ Map + JSON only; no parcel search API |

**Best setup for recruiters:** one **Railway** or **Render** URL (map + API + search) + GitHub repo with English README.

---

## Before you deploy

### 1. Secrets (never commit)

```powershell
copy .env.example .env
# Set MAPBOX_ACCESS_TOKEN=pk....
```

In [Mapbox](https://account.mapbox.com/access-tokens/), restrict the token by URL:

- `http://localhost:8000/*`
- `https://your-app.up.railway.app/*`
- `https://your-app.onrender.com/*`
- `https://jfgarci2.github.io/*` (if using GitHub Pages)

### 2. Parcel database (for full API search)

```powershell
$env:VERTEX_ROOT = ".."
python scripts/export_predios_full.py
```

Creates `data/predios.db` (~38 MB). It is **gitignored**. For cloud deploy you must either:

- **Option A:** Upload `predios.db` to Railway/Render persistent disk / volume  
- **Option B:** Include it in the deploy artifact from your machine (Railway CLI `railway up` with local folder)  
- **Option C:** Use PostGIS + `load_to_postgis.py` (Docker Compose locally, managed Postgres in cloud)

Without `predios.db`, the **map and JSON analytics still work**; `/api/predios/search` returns offline.

---

## GitHub — first publish

1. Create repo: https://github.com/new → name `vertex-rd-geoportal` (public)
2. In your project folder:

```powershell
cd vertex-rd-geoportal
git add .
git commit -m "feat: VERTEX RD geoportal — Mapbox GL JS, FastAPI, analytics"
git branch -M main
git remote add origin https://github.com/jfgarci2/vertex-rd-geoportal.git
git push -u origin main
```

3. **Settings → Pages → Build from branch `main` / root** (optional static mirror)

For Pages with Mapbox token, add repo secret `MAPBOX_ACCESS_TOKEN` (see `.github/workflows/pages.yml`).

---

## Railway (recommended)

1. Go to https://railway.app → **New Project → Deploy from GitHub**
2. Select `jfgarci2/vertex-rd-geoportal`
3. **Variables:**
   - `MAPBOX_ACCESS_TOKEN` = your pk token
4. **Settings → Root directory:** `/` (repo root)
5. Railway detects `Dockerfile` or use **Start command:**

   ```
   cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

6. Add `predios.db` to `data/` before deploy (Option A/B above)
7. Copy public URL → paste in README and portfolio

---

## Render (recommended — **Python, no Docker**)

You do **not** need Docker on your PC. Render runs Python from your GitHub repo.

### Settings

| Field | Value |
|-------|--------|
| **Runtime** | **Python 3** (not Docker) |
| **Build Command** | `pip install -r backend/requirements.txt` |
| **Start Command** | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/api/health` |
| **Env var** | `MAPBOX_ACCESS_TOKEN` = your `pk...` token |

### Fix if `css_exists: false` (Docker deploy)

1. **Settings → change Runtime from Docker to Python 3**
2. Set Build / Start commands as above
3. **Remove** `VERTEX_STATIC_DIR` if it exists in Environment
4. **Manual Deploy → Clear build cache & deploy**

Success check: `/api/health` shows `"css_exists": true`.  
**"Sin predios.db"** is normal without the database file — map + JSON still work.

### Activar SQLite 140K en Render (plan free)

Render **Secret Files solo acepta texto** (`.env`, claves) — **no puedes subir** `predios.db` binario ahí.

Tienes **2 opciones**:

#### Opción 1 — GitHub Release + URL (recomendada, repo público)

1. En tu PC, el archivo está en `vertex-rd-geoportal\data\predios.db` (~37 MB)

2. GitHub → repo → **Releases → Create a new release**
   - Tag: `v1.0.0-data`
   - Título: `predios.db`
   - Arrastra **`predios.db`** al área de assets (aquí sí hay upload)
   - **Publish release**

3. Clic derecho en el asset `predios.db` → **Copy link address**  
   Ejemplo: `https://github.com/jfgarci2/vertex-rd-geoportal/releases/download/v1.0.0-data/predios.db`

4. Render → **Environment → Environment Variables** (no Secret Files):
   - Key: `PREDIOS_DB_URL`
   - Value: la URL copiada

5. **Save → Manual Deploy → Clear build cache & deploy**

6. Verifica `/api/health` → `"status": "ok", "backend": "sqlite", "predios": 140237`

#### Opción 2 — Incluir en GitHub (más simple, +37 MB en el repo)

```powershell
cd vertex-rd-geoportal
git add -f data/predios.db
git commit -m "data: predios.db for Render SQLite API"
git push origin main
```

Render redeploy automático — no necesitas `PREDIOS_DB_URL`.

---

Sin `predios.db`, el geoportal funciona en **modo JSON** (mapa + ficha + tableros). Solo falta búsqueda API 140K.

---

## Fly.io (optional)

```powershell
fly launch --no-deploy
fly secrets set MAPBOX_ACCESS_TOKEN=pk....
fly deploy
```

Uses `Dockerfile` at repo root.

---

## Local production test

```powershell
docker build -t vertex-rd .
docker run -p 8000:8000 -e MAPBOX_ACCESS_TOKEN=pk.... -v ${PWD}/data:/app/data vertex-rd
```

Open http://localhost:8000

---

## After deploy — update portfolio

1. README **Live demo** table → your Railway/Render URL  
2. LinkedIn Featured → link to repo + live demo  
3. Attach [RECRUITER_SUMMARY.md](RECRUITER_SUMMARY.md) or [CASE_STUDY.md](CASE_STUDY.md) to applications  
