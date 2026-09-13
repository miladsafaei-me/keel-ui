# TODO

This file is the single source of truth for pending, follow-up, and deferred work on this project. See CLAUDE.md for the tracking rule.

Guidelines:
- Add a task here as soon as it's identified — with priority, prerequisites/dependencies, and enough context to pick it up cold.
- Group by priority: P0 (urgent / blocking / production risk), P1 (next up), P2 (backlog / nice-to-have).
- Note real dependencies explicitly ("Blocked by: ...", "Requires: ...").
- Delete a task from this file the moment it's done. This file only ever holds what's left.

## P2 — Backlog
- [ ] **Martiland still ships its own dropdown enhancer; move it onto the select menu.** `martiland/src/martiland/static/martiland/js/custom-select.js` (`select[data-msel]`, styled in `martiland/css/base.css`) does the job `keel_ui/js/select-menu.js` now does for every Keel consumer, with no keyboard navigation, no combobox role and no popover, so its panel can be clipped. Migrating is: add `keel_ui` to that project's `INSTALLED_APPS`, swap `data-msel` for `data-keel-select`, map `--keel-select-*` to Martiland's tokens (RTL: the panel aligns by `left`; check it flips correctly under `dir="rtl"` first and fix upstream here if not), delete the local script and its CSS. Its `data-msel-width` option has no equivalent; set a width on the `.keel-select` wrapper instead. An icon-per-option slot is the one feature prop-firm-review's older directory dropdown would also need.
- [ ] No automated test suite exists (no `tests/` dir, no pytest config, no test job in `.github/workflows/` — only `version-guard.yml`). 43 components ship with only `example.json` fixtures and no schema/render assertions. Add at least a smoke test per component (registry loads, schema validates `example.json`, `render()` produces HTML) before the catalog grows much further.
