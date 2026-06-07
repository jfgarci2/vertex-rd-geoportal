#!/usr/bin/env python3
"""Writes js/config.local.js from .env (gitignored). Run before local dev."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
OUT = ROOT / "js" / "config.local.js"


def load_env():
    if not ENV_FILE.exists():
        return {}
    out = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main():
    env = load_env()
    token = env.get("MAPBOX_ACCESS_TOKEN") or os.getenv("MAPBOX_ACCESS_TOKEN", "")
    api_base = env.get("VERTEX_API_BASE", "")
    payload = {"mapboxToken": token, "apiBase": api_base}
    OUT.write_text(
        "/** Auto-generated — do not commit. From .env via generate_local_config.py */\n"
        f"window.VERTEX_RUNTIME = {json.dumps(payload)};\n",
        encoding="utf-8",
    )
    if token:
        print(f"Wrote {OUT.name} (token pk...{token[-6:]})")
    else:
        print(f"Wrote {OUT.name} (no MAPBOX_ACCESS_TOKEN — set it in .env)")


if __name__ == "__main__":
    main()
