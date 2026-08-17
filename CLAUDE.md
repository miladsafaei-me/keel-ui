# CLAUDE.md — keel-ui

Guidance for Claude Code when working in the **keel-ui** package. This is a
[Keel](https://github.com/miladsafaei-me/keel-kit) capability package (Bucket 2).
The Keel platform constitution (`PLATFORM.md` in keel-kit) and the personal/global
rules in `~/.claude/CLAUDE.md` apply here unchanged; this file records what is
specific to this package.

## Task tracking

Remaining and follow-up work for this project is tracked in [TODO.md](TODO.md), not in chat memory. Every pending task — priority, prerequisites/dependencies, enough context to resume cold — goes there before starting new work; remove a task from TODO.md the moment it's done.

## What this package is

The `cp-*` visual component library: a typed on-disk registry + a Django-template
renderer. It is joined to a content pipeline (keel-content) by exactly two
artifacts — **the registry** (component discovery + JSON Schema) and **the
`cp-component` render request** `{component_id, spec}`. Everything brand/theme/
domain-specific is confined to the clean per-project seams below.

## Drift rule (hard)

This package is **linked in dev, pinned in the image — never copied** into a
consumer. Do **not** edit a vendored/installed copy inside a consumer repo
(e.g. a `site-packages/keel_ui` or a re-export shim in SignalBots) — edit the
source **here** and let the consumer re-pin. A consumer keeps only a thin
re-export shim + host config, never a fork of the machinery.

## The extraction seams (keep these clean)

1. **Theme signal** — the JS runtime reads a configurable attribute on `<html>`
   (`KEEL_UI["theme_attribute"]`, default `data-keel-theme`; "dark default"
   polarity). Never hardcode a host-specific attribute name (`data-sb-theme`) into
   the JS/CSS — route it through config.
2. **`--cp-*` token block** — the theme override surface at the top of
   `static/keel_ui/css/content-pipeline.css`. The `cp-*` styles must stay
   self-contained (no `var()` reference to host brand tokens).
3. **`risk_warning_callout` URL** — the trading compliance link target comes from
   `KEEL_UI["risk_warning_url"]`, never a hardcoded `/risk-warning`.
4. **Component packs** — each `manifest.json` carries `pack: "core" | "trading"`.
   `core` must never depend on `trading`. Keep buy/sell + IB/copy-trade components
   in `trading` so a non-trading host isn't forced to carry them.
5. **Example data** — `example.json` must be brand-neutral (no "SignalBots ..."
   framing). It is author/showcase reference, not a place for a host's brand.

## Catalog is generated, never hand-edited

`components/CATALOG.md` is rewritten by the `sync_component_catalog` command from
the registry. Editing a component's `manifest.json` `when_to_pick` then running
that command is the only correct way to change the catalog. A hand-edit drifts and
an author agent will point at a dead `component_id`.

## Adding / changing a component

One folder under `components/<category>/<id>/`: `manifest.json` (with `id`, `name`,
`category`, `version`, `when_to_pick`, `pack`, `schema`), `template.html`,
`example.json`, optional `template.js`. `id` unique; folder category must match
the manifest `category`. Re-run `sync_component_catalog` after.

## Release

Bump `version` in `pyproject.toml`, tag `vX.Y.Z`. Consumers re-pin `keel-ui==X.Y.Z`
in their image requirements; local dev picks it up live via the editable install.
