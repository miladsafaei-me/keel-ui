"""Template helpers for component templates.

Loaded automatically by the renderer so component authors can use them without
``{% load %}`` (see renderer.py).
"""

from __future__ import annotations

import html
import json
from typing import Any

from django import template
from django.utils.safestring import mark_safe

register = template.Library()


@register.filter(name="to_attr_json")
def to_attr_json(value: Any) -> str:
    """Serialize ``value`` as JSON and HTML-escape for use inside an attribute.

    Use as: ``<canvas data-cp-chart="{{ config|to_attr_json }}"></canvas>``.
    """
    return mark_safe(html.escape(json.dumps(value, ensure_ascii=False), quote=True))


@register.filter(name="to_json")
def to_json(value: Any) -> str:
    """Serialize ``value`` as JSON for inline use (e.g. inside <script> blocks)."""
    return mark_safe(json.dumps(value, ensure_ascii=False))


@register.simple_tag(name="cp_rrv_geometry")
def cp_rrv_geometry(entry: Any, sl: Any, tp: Any, decimals: Any = 4) -> dict:
    """Compute the Risk:Reward visualizer's static-fallback geometry server-side.

    Mirrors the arithmetic in ``risk-reward-visualizer/template.js`` so the pre-JS
    (and no-JS / scraper) fallback ladder, bands and summary always match the
    widget's own entry/sl/tp inputs — instead of a hardcoded EUR/USD placeholder
    that contradicts the instrument the spec actually carries (e.g. a silver or
    BTC setup rendering EUR/USD 4-decimal prices before the script runs).
    """
    try:
        entry_f, sl_f, tp_f = float(entry), float(sl), float(tp)
    except (TypeError, ValueError):
        entry_f, sl_f, tp_f = 1.0850, 1.0820, 1.0910
    try:
        dec = int(decimals)
    except (TypeError, ValueError):
        dec = 4
    if dec < 0 or dec > 6:
        dec = 4

    is_long = tp_f >= entry_f
    risk = abs(entry_f - sl_f)
    reward = abs(tp_f - entry_f)
    rr = reward / risk if risk > 0 else 0.0
    be_wr = (1.0 / (rr + 1.0)) * 100.0 if rr > 0 else 100.0

    top = max(tp_f, sl_f, entry_f)
    bot = min(tp_f, sl_f, entry_f)
    rng = top - bot

    def pos(price: float) -> float:
        return ((top - price) / rng) * 100.0 if rng > 0 else 50.0

    entry_pct = pos(entry_f)
    reward_top = pos(tp_f) if is_long else entry_pct
    reward_h = (entry_pct - pos(tp_f)) if is_long else (pos(tp_f) - entry_pct)
    risk_top = entry_pct if is_long else pos(sl_f)
    risk_h = (pos(sl_f) - entry_pct) if is_long else (entry_pct - pos(sl_f))

    def fmt(n: float) -> str:
        return f"{n:.{dec}f}"

    if rr >= 1:
        note = f"You aim for {rr:.2f}x what you risk"
    elif rr > 0:
        note = "Reward is smaller than risk"
    else:
        note = "Set a stop to define risk"

    return {
        "dir_label": "Long setup" if is_long else "Short setup",
        "dir_attr": "long" if is_long else "short",
        "risk": fmt(risk),
        "reward": fmt(reward),
        "rr": f"{rr:.2f}",
        "be": f"{be_wr:.1f}",
        "good": "true" if rr >= 1 else "false",
        "note": note,
        "reward_top": f"{reward_top:.3f}",
        "reward_h": f"{max(reward_h, 0.0):.3f}",
        "risk_top": f"{risk_top:.3f}",
        "risk_h": f"{max(risk_h, 0.0):.3f}",
        "tp_pos": f"{pos(tp_f):.3f}",
        "entry_pos": f"{entry_pct:.3f}",
        "sl_pos": f"{pos(sl_f):.3f}",
        "tp_label": f"TP {fmt(tp_f)}",
        "entry_label": f"Entry {fmt(entry_f)}",
        "sl_label": f"SL {fmt(sl_f)}",
    }


# Categorical slice palette for doughnut / pie / polar-area. Mirrors the
# window.cpTheme series() palette (content-pipeline.js) so slice charts match
# every other multi-series chart. Deliberately carries NO trade-semantic red or
# green — those mean BUY/SELL and must never colour a generic category. The
# runtime maps each hex to its dark-mode sibling via HEX_MAP_LIGHT_TO_DARK.
_SLICE_PALETTE = ["#2563eb", "#0891b2", "#a78bfa", "#d97706", "#ec4899",
                  "#14b8a6", "#6366f1", "#64748b"]


def _slice_colors(values: list, alpha_suffix: str = "") -> list:
    """Assign a slice colour per value, cycling the palette so any count is filled."""
    n = len(_SLICE_PALETTE)
    return [_SLICE_PALETTE[i % n] + alpha_suffix for i in range(len(values))]


def _attr_json(value: Any) -> str:
    return mark_safe(html.escape(json.dumps(value, ensure_ascii=False), quote=True))


def _slice_config(chart_type: str, title: str, labels: list, values: list) -> dict:
    return {
        "type": chart_type,
        "data": {
            "labels": list(labels),
            "datasets": [{
                "data": list(values),
                "backgroundColor": _slice_colors(values),
                "borderWidth": 2,
            }],
        },
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": True, "position": "bottom"},
            },
        },
    }


@register.simple_tag(name="cp_doughnut_config")
def cp_doughnut_config(title: str, labels: list, values: list) -> str:
    """Build a Chart.js doughnut config from a labels + values pair."""
    return _attr_json(_slice_config("doughnut", title, labels, values))


@register.simple_tag(name="cp_pie_config")
def cp_pie_config(title: str, labels: list, values: list) -> str:
    """Build a Chart.js pie config from a labels + values pair."""
    return _attr_json(_slice_config("pie", title, labels, values))


@register.simple_tag(name="cp_polar_area_config")
def cp_polar_area_config(title: str, labels: list, values: list) -> str:
    """Build a Chart.js polarArea config from a labels + values pair (translucent)."""
    cfg = _slice_config("polarArea", title, labels, values)
    cfg["data"]["datasets"][0]["backgroundColor"] = _slice_colors(values, "B3")
    return _attr_json(cfg)


_RADAR_TONES = {
    "accent":  ("rgba(37,99,235,0.18)",  "#2563eb"),
    "success": ("rgba(22,163,74,0.18)",  "#16a34a"),
    "danger":  ("rgba(220,38,38,0.18)",  "#dc2626"),
    "warning": ("rgba(217,119,6,0.18)",  "#d97706"),
    "neutral": ("rgba(100,116,139,0.18)","#64748b"),
    "purple":  ("rgba(167,139,250,0.18)","#a78bfa"),
}


@register.simple_tag(name="cp_radar_config")
def cp_radar_config(title: str, labels: list, datasets: list, max_value: float = 100) -> str:
    """Build a Chart.js radar config. Datasets accept a `tone` field."""
    enriched = []
    for ds in datasets:
        ds = dict(ds)
        tone = ds.pop("tone", "accent")
        bg, border = _RADAR_TONES.get(tone, _RADAR_TONES["accent"])
        ds.setdefault("backgroundColor", bg)
        ds.setdefault("borderColor", border)
        ds.setdefault("pointBackgroundColor", border)
        ds.setdefault("borderWidth", 2)
        ds.setdefault("pointRadius", 3.5)
        enriched.append(ds)
    config = {
        "type": "radar",
        "data": {"labels": list(labels), "datasets": enriched},
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": True, "position": "bottom"},
            },
            "scales": {"r": {"beginAtZero": True, "suggestedMax": max_value}},
        },
    }
    return _attr_json(config)


_SCATTER_TONES = {
    "accent":  ("rgba(37,99,235,0.6)",  "#2563eb"),
    "success": ("rgba(22,163,74,0.6)",  "#16a34a"),
    "danger":  ("rgba(220,38,38,0.6)",  "#dc2626"),
    "warning": ("rgba(217,119,6,0.6)",  "#d97706"),
    "purple":  ("rgba(167,139,250,0.6)","#a78bfa"),
}


@register.simple_tag(name="cp_scatter_config")
def cp_scatter_config(title: str, datasets: list, x_label: str = "", y_label: str = "") -> str:
    """Build a Chart.js scatter config. Each dataset.data is a list of {x, y} dicts."""
    enriched = []
    for ds in datasets:
        ds = dict(ds)
        tone = ds.pop("tone", "accent")
        bg, border = _SCATTER_TONES.get(tone, _SCATTER_TONES["accent"])
        ds.setdefault("backgroundColor", bg)
        ds.setdefault("borderColor", border)
        ds.setdefault("pointRadius", 5)
        ds.setdefault("pointHoverRadius", 7)
        enriched.append(ds)
    config = {
        "type": "scatter",
        "data": {"datasets": enriched},
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": True, "position": "bottom"},
            },
            "scales": {
                "x": {"type": "linear", "title": {"display": bool(x_label), "text": x_label}},
                "y": {"title": {"display": bool(y_label), "text": y_label}},
            },
        },
    }
    return _attr_json(config)


@register.simple_tag(name="cp_area_config")
def cp_area_config(
    title: str, labels: list, values: list, tone: str = "success",
    y_label: str = "", markers: Any = None,
) -> str:
    """Build a single-series filled line (area) Chart.js config.

    Optional ``markers`` is a list of ``{at, label, tone?}`` where ``at`` is an
    x-axis label from ``labels``; each resolves to a data index and is emitted as
    ``options.plugins.cpMarkers`` for the runtime cpMarkers plugin to draw.
    """
    tones = {
        "accent":  ("rgba(37,99,235,0.22)",  "#2563eb"),
        "success": ("rgba(22,163,74,0.22)",  "#16a34a"),
        "danger":  ("rgba(220,38,38,0.22)",  "#dc2626"),
        "warning": ("rgba(217,119,6,0.22)",  "#d97706"),
    }
    bg, border = tones.get(tone, tones["success"])
    label_list = list(labels)
    plugins: dict[str, Any] = {
        "title": {"display": bool(title), "text": title},
        "legend": {"display": False},
    }
    if isinstance(markers, (list, tuple)) and markers:
        cp_markers = []
        for m in markers:
            if not isinstance(m, dict):
                continue
            try:
                idx = label_list.index(m.get("at"))
            except ValueError:
                continue
            cp_markers.append({"index": idx, "label": m.get("label", ""), "tone": m.get("tone", "accent")})
        if cp_markers:
            plugins["cpMarkers"] = cp_markers
    config = {
        "type": "line",
        "data": {
            "labels": label_list,
            "datasets": [{
                "label": title or "",
                "data": list(values),
                "backgroundColor": bg,
                "borderColor": border,
                "pointBackgroundColor": border,
                "fill": True,
                "tension": 0.3,
                "pointRadius": 2,
                "borderWidth": 2,
            }],
        },
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": plugins,
            "scales": {
                # `grace` pads the value axis so the curve + any markers don't jam
                # against the top/bottom edges (e.g. a drawdown trough label).
                "y": {"grace": "12%", "title": {"display": bool(y_label), "text": y_label}},
            },
        },
    }
    return _attr_json(config)


@register.simple_tag(name="cp_stacked_bar_config")
def cp_stacked_bar_config(title: str, labels: list, datasets: list) -> str:
    """Build a Chart.js stacked-bar config from labels + datasets (each with tone)."""
    bar_tones = {
        "accent":  ("rgba(96,165,250,0.85)",  "#2563eb"),
        "success": ("rgba(34,197,94,0.85)",   "#16a34a"),
        "danger":  ("rgba(220,38,38,0.85)",   "#dc2626"),
        "warning": ("rgba(245,158,11,0.85)",  "#d97706"),
        "purple":  ("rgba(167,139,250,0.85)", "#a78bfa"),
        "neutral": ("rgba(148,163,184,0.85)", "#64748b"),
    }
    enriched = []
    for ds in datasets:
        ds = dict(ds)
        tone = ds.pop("tone", "accent")
        bg, border = bar_tones.get(tone, bar_tones["accent"])
        ds.setdefault("backgroundColor", bg)
        ds.setdefault("borderColor", border)
        ds.setdefault("borderWidth", 1)
        ds.setdefault("borderRadius", 4)
        ds.setdefault("stack", "stack-0")
        enriched.append(ds)
    config = {
        "type": "bar",
        "data": {"labels": list(labels), "datasets": enriched},
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": True, "position": "bottom"},
            },
            "scales": {
                "x": {"stacked": True},
                "y": {"stacked": True},
            },
        },
    }
    return _attr_json(config)


@register.simple_tag(name="cp_chart_config")
def cp_chart_config(chart_type: str, title: str, labels: list, datasets: list) -> str:
    """Build a Chart.js config object (as attribute-safe JSON) from spec fields.

    Datasets may carry an optional ``tone`` field; the helper maps it to
    background/border colors that the runtime palette helper (window.cpTheme)
    further patches for dark mode.
    """
    # Per-chart-type palette: bars want opaque fills; lines want a subtle fill
    # under the curve plus a strong border; doughnut/pie keep the per-slice color array.
    is_line = chart_type in ("line", "area")
    tone_palette_bar = {
        "accent":  ("rgba(96,165,250,0.7)",  "#2563eb"),
        "success": ("rgba(34,197,94,0.65)",  "#16a34a"),
        "danger":  ("rgba(220,38,38,0.55)",  "#dc2626"),
        "warning": ("rgba(245,158,11,0.6)",  "#d97706"),
        "neutral": ("rgba(148,163,184,0.6)", "#64748b"),
    }
    tone_palette_line = {
        "accent":  ("rgba(37,99,235,0.15)",  "#2563eb"),
        "success": ("rgba(22,163,74,0.15)",  "#16a34a"),
        "danger":  ("rgba(220,38,38,0.15)",  "#dc2626"),
        "warning": ("rgba(217,119,6,0.15)",  "#d97706"),
        "neutral": ("rgba(100,116,139,0.15)","#64748b"),
    }
    tone_palette = tone_palette_line if is_line else tone_palette_bar
    enriched = []
    for ds in datasets:
        ds = dict(ds)
        tone = ds.pop("tone", None)
        if tone and "backgroundColor" not in ds:
            bg, border = tone_palette.get(tone, tone_palette["accent"])
            ds.setdefault("backgroundColor", bg)
            ds.setdefault("borderColor", border)
            if is_line:
                ds.setdefault("pointBackgroundColor", border)
        if is_line:
            ds.setdefault("fill", True)
            ds.setdefault("tension", 0.35)
            ds.setdefault("pointRadius", 3)
            ds.setdefault("borderWidth", 2)
        else:
            ds.setdefault("borderWidth", 1)
            ds.setdefault("borderRadius", 6)
        enriched.append(ds)

    config = {
        "type": chart_type,
        "data": {"labels": labels, "datasets": enriched},
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": True, "position": "bottom"},
            },
        },
    }
    return mark_safe(html.escape(json.dumps(config, ensure_ascii=False), quote=True))
