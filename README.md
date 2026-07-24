# keel-ui

**Keel UI** — a typed, themeable catalog of visual content components (the `cp-*`
library) plus a renderer, for Django content pipelines. Extracted from SignalBots
as a reusable [Keel](https://github.com/miladsafaei-me/keel-kit) capability
(Bucket 2 — versioned code package).

The library owns the two artifacts a content pipeline consumes:

1. **The registry** — component discovery + a per-component JSON Schema
   (Draft 2020-12). One folder per component under `components/<category>/<id>/`,
   each with `manifest.json`, `template.html`, `example.json`, and optional
   `template.js`. A light auto-generated `components/CATALOG.md` indexes them for
   an authoring agent.
2. **The renderer** — validates a `spec` against the component's schema, renders
   its `template.html` (Django template engine), and inlines any `template.js`.

A content pipeline emits each visual as a fenced ` ```cp-component ` JSON block
`{component_id, spec, caption, eyebrow}`; the host's embed step calls
`keel_ui.render(component_id, spec)` and wraps the HTML in a `<figure>`.

## Install (development — link, don't copy)

```bash
pip install -e /home/milad/www/keel-ui
```

In production the image pins an exact version (`keel-ui==x.y.z`). Shared code is
**linked in dev, pinned in the image — never copied into a consumer.**

## Use in a Django host

```python
# settings.py
INSTALLED_APPS = [
    # ...
    "keel_ui",
]

# Optional host config — every key shown here is already the neutral default, so a
# host only sets the ones it needs to change:
KEEL_UI = {
    "theme_attribute": "data-keel-theme",  # attr on <html> carrying light/dark; a host
                                           # with its own signal sets e.g. "data-sb-theme"
    "theme_default_dark": True,
    "risk_warning_url": None,              # set (e.g. "/risk-warning") only on a trading
                                           # host that renders the risk callout
    "enabled_packs": ["core"],             # add "trading" on a trading host
}
```

```python
from keel_ui import render, get_component, iter_components

html = render("chart_doughnut", {"title": "...", "slices": [...]})
```

The optional showcase lives at `keel_ui.urls` (mount under any path):

```python
path("component-library/", include("keel_ui.urls")),
```

## Theming — the override surface

The whole library re-themes through **one block of `--cp-*` CSS custom
properties** at the top of `static/keel_ui/css/content-pipeline.css` (light + dark
value sets). The `cp-*` styles are self-contained — they do **not** `var()`-reference
any host brand tokens — so a host themes the library by overriding `--cp-*` alone.

## Component packs

- **core** — format-agnostic visuals (charts, compare, flows, interactive,
  reference, structure). Reusable in any project.
- **trading** — buy/sell + IB/copy-trade domain visuals (trade-visuals,
  risk-performance, IB tiers). For trading hosts. Select via `KEEL_UI["enabled_packs"]`.
