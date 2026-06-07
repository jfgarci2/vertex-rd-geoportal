#!/usr/bin/env python3
"""Inject MAPBOX_ACCESS_TOKEN into js/config.js for GitHub Pages static deploy."""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "js", "config.js")
TOKEN = os.environ.get("MAPBOX_ACCESS_TOKEN", "")

if not TOKEN:
    print("MAPBOX_ACCESS_TOKEN not set — skipping injection (map will need token manually)")
    sys.exit(0)

text = open(CONFIG, encoding="utf-8").read()
updated, n = re.subn(r"mapboxToken:\s*''", f"mapboxToken: {repr(TOKEN)}", text, count=1)
if n != 1:
    print("Could not find mapboxToken placeholder in config.js", file=sys.stderr)
    sys.exit(1)
open(CONFIG, "w", encoding="utf-8").write(updated)
print("Mapbox token injected for GitHub Pages")
