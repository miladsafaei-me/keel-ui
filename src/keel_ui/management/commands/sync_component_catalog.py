"""``./manage.py sync_component_catalog`` — regenerate the light component
catalog file (``components/CATALOG.md``) from the live registry.

The catalog is the authoritative "every component + what it is for" list the
article-generation agent reads ON DEMAND (the author brief keeps only the
reader's-JOB mapping table and points here). It must never be hand-maintained — it
drifts the moment a component is added, renamed, or pruned (which silently points
agents at dead ``component_id``s, so the publisher drops those visuals). This
command rewrites the marker-delimited catalog region with a LIGHT entry per
component (``id`` + one-line ``when_to_pick`` only — no schema or example; the
agent reads the manifest for the schema once it has picked).

Run it after any change under ``components/``.
"""

from __future__ import annotations

import re

from django.core.management.base import BaseCommand, CommandError

from keel_ui.paths import components_root
from keel_ui.registry import load_registry

START = "<!-- AUTOGEN:component-catalog START — regenerate with: manage.py sync_component_catalog -->"
END = "<!-- AUTOGEN:component-catalog END -->"


def _catalog_block() -> str:
    """Light catalog grouped by category, ids sorted: each line is `id` — when_to_pick."""
    reg = load_registry(reload=True)
    lines: list[str] = []
    for category in sorted(reg.by_category):
        lines.append(f"     **{category}**")
        for c in sorted(reg.by_category[category], key=lambda c: c.id):
            lines.append(f"     - `{c.id}` — {c.when_to_pick}")
        lines.append("")
    return "\n".join(lines).rstrip()


def _catalog_path():
    return components_root() / "CATALOG.md"


class Command(BaseCommand):
    help = "Regenerate the light component catalog (components/CATALOG.md)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Exit non-zero if CATALOG.md is out of sync (don't write). For CI.",
        )

    def handle(self, *args, **opts):
        catalog = _catalog_path()
        if not catalog.is_file():
            raise CommandError(f"catalog file not found at {catalog}")

        text = catalog.read_text(encoding="utf-8")
        if START not in text or END not in text:
            raise CommandError(
                f"catalog markers not found in {catalog.name}; "
                f"add a region delimited by:\n  {START}\n  {END}"
            )

        block = _catalog_block()
        count = block.count("\n     - `")
        new_region = f"{START}\n{block}\n{END}"
        pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
        new_text = pattern.sub(lambda _m: new_region, text, count=1)

        if opts["check"]:
            if new_text != text:
                raise CommandError(
                    "component catalog (components/CATALOG.md) is stale — "
                    "run `manage.py sync_component_catalog`"
                )
            self.stdout.write(self.style.SUCCESS("catalog is in sync"))
            return

        if new_text == text:
            self.stdout.write("catalog already up to date")
        else:
            catalog.write_text(new_text, encoding="utf-8")
            self.stdout.write(
                self.style.SUCCESS(f"catalog synced: {count} components written to {catalog.name}")
            )
