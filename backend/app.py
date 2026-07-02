"""Vercel Python entrypoint.

Vercel auto-detects `app.py` (with an `app` ASGI instance) at the service
root. We insert `src/` on the path explicitly so the import works regardless
of how the runtime resolves the `coinco_rep` package layout.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from coinco_rep.main import app  # noqa: E402
