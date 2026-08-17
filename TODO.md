# TODO

This file is the single source of truth for pending, follow-up, and deferred work on this project. See CLAUDE.md for the tracking rule.

Guidelines:
- Add a task here as soon as it's identified — with priority, prerequisites/dependencies, and enough context to pick it up cold.
- Group by priority: P0 (urgent / blocking / production risk), P1 (next up), P2 (backlog / nice-to-have).
- Note real dependencies explicitly ("Blocked by: ...", "Requires: ...").
- Delete a task from this file the moment it's done. This file only ever holds what's left.

## P2 — Backlog
- [ ] No automated test suite exists (no `tests/` dir, no pytest config, no test job in `.github/workflows/` — only `version-guard.yml`). 43 components ship with only `example.json` fixtures and no schema/render assertions. Add at least a smoke test per component (registry loads, schema validates `example.json`, `render()` produces HTML) before the catalog grows much further.
