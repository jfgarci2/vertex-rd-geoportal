#!/usr/bin/env python3
"""Descarga predios.db en el build de Render si PREDIOS_DB_URL está definida."""
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "predios.db"
MIN_SIZE = 1_000_000


def main() -> int:
    if DB.is_file() and DB.stat().st_size >= MIN_SIZE:
        print(f"predios.db OK ({DB.stat().st_size:,} bytes)")
        return 0

    url = os.getenv("PREDIOS_DB_URL", "").strip()
    if not url:
        print("PREDIOS_DB_URL no definida — API usará modo JSON (sin búsqueda 140K)")
        return 0

    print(f"Descargando predios.db…")
    DB.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "VERTEX-RD-deploy"})
    with urllib.request.urlopen(req, timeout=600) as resp, open(DB, "wb") as out:
        out.write(resp.read())

    size = DB.stat().st_size
    if size < MIN_SIZE:
        print(f"Error: archivo demasiado pequeño ({size} bytes)", file=sys.stderr)
        DB.unlink(missing_ok=True)
        return 1
    print(f"predios.db listo ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
