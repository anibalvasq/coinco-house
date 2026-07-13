#!/usr/bin/env python3
"""Generate PWA PNG icons from public/icons/icon.svg (requires: pip install cairosvg pillow)."""
from pathlib import Path

try:
    import cairosvg
except ImportError:
    print("Install: pip install cairosvg")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "public" / "icons" / "icon.svg"
OUT = ROOT / "public" / "icons"

for size in (192, 512):
    out = OUT / f"icon-{size}.png"
    cairosvg.svg2png(url=str(SVG), write_to=str(out), output_width=size, output_height=size)
    print(f"Wrote {out}")
