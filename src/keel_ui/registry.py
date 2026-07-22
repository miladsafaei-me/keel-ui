"""Registry: scans the packaged `components/` directory and loads each manifest.

The registry is built lazily on first access and cached for the lifetime of the
process. In DEBUG mode, callers can force a reload via `load_registry(reload=True)`
or the showcase view can pass `?reload=1` for live editing.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator

from .paths import components_root


class ComponentNotFound(Exception):
    """Raised when a component_id has no matching manifest."""


@dataclass(frozen=True)
class Component:
    id: str
    name: str
    category: str
    version: int
    when_to_pick: str
    tags: tuple[str, ...]
    audience_fit: tuple[str, ...]
    dependencies: tuple[str, ...]
    schema: dict[str, Any]
    folder: Path
    template_html: str
    template_js: str | None
    example: dict[str, Any]

    @property
    def slug(self) -> str:
        return self.id.replace("_", "-")


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _load_component(folder: Path, category: str) -> Component:
    manifest_path = folder / "manifest.json"
    template_path = folder / "template.html"
    example_path = folder / "example.json"
    js_path = folder / "template.js"

    if not manifest_path.is_file():
        raise FileNotFoundError(f"missing manifest.json in {folder}")
    if not template_path.is_file():
        raise FileNotFoundError(f"missing template.html in {folder}")
    if not example_path.is_file():
        raise FileNotFoundError(f"missing example.json in {folder}")

    manifest = _read_json(manifest_path)
    example = _read_json(example_path)
    template_html = template_path.read_text(encoding="utf-8")
    template_js = js_path.read_text(encoding="utf-8") if js_path.is_file() else None

    required_top = {"id", "name", "category", "version", "when_to_pick", "schema"}
    missing = required_top - manifest.keys()
    if missing:
        raise ValueError(f"{folder}: manifest missing required fields {sorted(missing)}")

    if manifest["category"] != category:
        raise ValueError(
            f"{folder}: manifest category={manifest['category']!r} "
            f"but folder lives under {category!r}"
        )

    return Component(
        id=manifest["id"],
        name=manifest["name"],
        category=manifest["category"],
        version=int(manifest["version"]),
        when_to_pick=manifest["when_to_pick"],
        tags=tuple(manifest.get("tags") or ()),
        audience_fit=tuple(manifest.get("audience_fit") or ()),
        dependencies=tuple(manifest.get("dependencies") or ()),
        schema=manifest["schema"],
        folder=folder,
        template_html=template_html,
        template_js=template_js,
        example=example,
    )


@dataclass
class Registry:
    components: dict[str, Component] = field(default_factory=dict)
    by_category: dict[str, list[Component]] = field(default_factory=dict)

    def iter_categories(self) -> Iterator[tuple[str, list[Component]]]:
        for cat in sorted(self.by_category):
            yield cat, sorted(self.by_category[cat], key=lambda c: c.name)


_CACHED: Registry | None = None


def load_registry(*, reload: bool = False) -> Registry:
    """Build (or return cached) registry of every component on disk."""
    global _CACHED
    if _CACHED is not None and not reload:
        return _CACHED

    root = components_root()
    reg = Registry()
    if not root.is_dir():
        _CACHED = reg
        return reg

    for category_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        category = category_dir.name
        for comp_dir in sorted(p for p in category_dir.iterdir() if p.is_dir()):
            comp = _load_component(comp_dir, category)
            if comp.id in reg.components:
                raise ValueError(
                    f"duplicate component id {comp.id!r}: "
                    f"{reg.components[comp.id].folder} and {comp.folder}"
                )
            reg.components[comp.id] = comp
            reg.by_category.setdefault(category, []).append(comp)

    _CACHED = reg
    return reg


def get_component(component_id: str, *, reload: bool = False) -> Component:
    reg = load_registry(reload=reload)
    try:
        return reg.components[component_id]
    except KeyError:
        pass
    # Canonical ids are underscored (``intent_hero``); authors routinely emit the
    # hyphenated folder-name form (``intent-hero``). Normalize rather than drop the
    # whole visual over a dash.
    normalized = (component_id or "").replace("-", "_")
    try:
        return reg.components[normalized]
    except KeyError as exc:
        raise ComponentNotFound(component_id) from exc


def iter_components(*, reload: bool = False) -> Iterator[Component]:
    reg = load_registry(reload=reload)
    yield from reg.components.values()
