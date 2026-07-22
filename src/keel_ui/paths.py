"""Resolve the on-disk component registry root for keel-ui.

The component registry ships inside this package as package data
(`keel_ui/components/`). A host project may point the loader elsewhere — for
example to a directory of project-local components — via either:

  1. The ``KEEL_UI_COMPONENTS_ROOT`` environment variable (highest priority).
  2. Falling back to the packaged ``components/`` directory next to this file.

Keeping this resolution here (rather than reaching into a host app's path
helpers) is the seam that decouples the library from any single project layout.
"""

from __future__ import annotations

import os
from pathlib import Path


def components_root() -> Path:
    """Return the absolute path to the component registry directory."""
    override = os.environ.get("KEEL_UI_COMPONENTS_ROOT")
    if override:
        p = Path(override).resolve()
        if not p.is_dir():
            raise FileNotFoundError(f"KEEL_UI_COMPONENTS_ROOT does not exist: {p}")
        return p
    return Path(__file__).resolve().parent / "components"
