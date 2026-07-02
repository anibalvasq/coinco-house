"""Vercel Python serverless function entrypoint.

Vercel serves every .py file in api/ as a serverless function.
All requests to /api/* are rewritten here by vercel.json rewrites.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend" / "src"))

from coinco_rep.main import app  # noqa: E402
