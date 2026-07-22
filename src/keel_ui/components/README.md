# Component Library

Typed component catalog for the `content_pipeline`. Each component is a self-contained folder under one of the category directories. The blog author (per [`prompts/agent-author-brief.md`](../prompts/agent-author-brief.md) §2.4, concept-first) picks a component by `id` and emits a `spec` matching the component's `schema` as a fenced `cp-component` data block; at import the renderer expands the component's `template.html` with that spec to produce final HTML.

## Folder shape

```
<category>/<component-id>/
├── manifest.json    required
├── template.html    required (Django template snippet, receives spec as context)
├── template.js      optional (inline JS for interactivity, inlined into the rendered HTML inside <script>)
└── example.json     required (realistic spec used by the showcase page)
```

## `manifest.json` shape

```json
{
  "id": "comparison_table",
  "name": "Comparison Table",
  "category": "compare",
  "version": 1,
  "when_to_pick": "When the article compares 3+ items across 3+ dimensions and the reader benefits from a side-by-side scan.",
  "tags": ["comparison", "decision-aid"],
  "audience_fit": ["forex", "crypto", "binary", "prop-firm"],
  "dependencies": [],
  "schema": {
    "type": "object",
    "required": ["columns", "rows"],
    "properties": { /* full JSON Schema */ }
  }
}
```

### Field meanings

- **id** — stable slug, snake_case. Never renamed once shipped (LLM specs reference it).
- **category** — one of the category folder names.
- **version** — integer; bump on breaking schema changes.
- **when_to_pick** — short prose telling the LLM *when* to pick this component. The full registry index is auto-synced into the author brief by `manage.py sync_component_catalog`.
- **tags / audience_fit** — used for filtering in the showcase UI.
- **dependencies** — `chartjs` and/or `mermaid` if the component requires those loaders on the page.
- **schema** — JSON Schema (draft-07-ish). Validated before rendering. Unknown fields rejected (additionalProperties=false).

## Categories (job-first)

Components are grouped by the **job the writer is doing**, not by render tech. The
same grouping is mirrored in the blog author brief and the `/component-library/` showcase.

- **structure** — the article skeleton (prose-bearing): intent-hero, beat-section, element-card, closing-loop
- **compare** — weigh options side by side: versus-card, comparison-table, before-after, scenario-cards, chart-radar
- **charts** — quantify with Chart.js: chart-area (line/area), chart-bar, chart-stacked-bar, chart-doughnut, cost-breakdown-bar, correlation-matrix, gauge-meter, kpi-sparkline-card
- **risk-performance** — risk & track-record: drawdown-chart, monte-carlo-simulator, expectancy-grid, backtest-metrics-panel, risk-reward-visualizer, trade-log-table
- **flows** — process & decision diagrams: how-it-works-steps, timeline, decision-tree, sequence (mermaid), state (mermaid), flowchart (mermaid)
- **structure-maps** — relationships, org & economics: hierarchy, funnel, ib-commission-tiers, copy-trade-flow, anatomy-diagram
- **trade-visuals** — domain trade visuals: annotated-price-chart, binary-options-payoff, forex-session-clock, limit-tracker, order-book-ladder
- **interactive** — reader-manipulated: calculator, checklist, quiz-single, accordion-faq, live-simulator-candlestick
- **reference** — reference & compliance: code-block, formula-block, risk-warning-callout

## Non-negotiable rules

1. Templates use only `cp-*` CSS classes (defined in `backend/blog/static/blog/css/content-pipeline.css`). Never inline hex colors.
2. Anything theme-aware reads from `window.cpTheme.palette()` at runtime, not hardcoded.
3. Mermaid: never `rgba()` in classDef — use 8-digit hex `#RRGGBBAA`.
4. Templates must render correctly under both `prefers-color-scheme: light` AND `dark`.
5. Schemas reject `additionalProperties` by default — strict typing wins over leniency.
