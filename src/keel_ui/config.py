"""Host-configurable surface for keel-ui — the CONFIG-CONTRACT seam.

A host project supplies these via a ``KEEL_UI`` dict in Django settings. Every
value has a neutral default so the package is usable with zero configuration;
projects override only what they need.

    KEEL_UI = {
        # Attribute on <html> that carries the light/dark signal the JS runtime
        # reads. Defaults to a Keel-neutral name; SignalBots sets "data-sb-theme".
        "theme_attribute": "data-keel-theme",

        # Whether "dark" is the default when the attribute is absent.
        "theme_default_dark": True,

        # Target URL for the trading `risk_warning_callout` component. Left None
        # for non-trading hosts (the component then omits the link).
        "risk_warning_url": None,

        # Which component packs load from the registry. "core" = format-agnostic
        # visuals reusable anywhere; "trading" = buy/sell + IB/copy-trade domain. The
        # neutral default is core-only; a trading host adds "trading".
        "enabled_packs": ["core"],
    }
"""

from __future__ import annotations

from typing import Any

from django.conf import settings

_DEFAULTS: dict[str, Any] = {
    "theme_attribute": "data-keel-theme",
    "theme_default_dark": True,
    "risk_warning_url": None,
    "enabled_packs": ["core", "trading"],
}


def get_config() -> dict[str, Any]:
    """Return the effective keel-ui config (defaults overlaid with host settings)."""
    cfg = dict(_DEFAULTS)
    cfg.update(getattr(settings, "KEEL_UI", {}) or {})
    return cfg
