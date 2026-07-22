"""Renderer: take (component_id, spec) and produce final HTML.

Flow:
  1. Look up component in the registry.
  2. Validate spec against the component's JSON Schema (`additionalProperties=false`
     by default — strict typing).
  3. Render template.html with Django's template engine, with the spec as context.
  4. If template.js exists, inline it inside a <script> tag with a unique nonce-like
     id so multiple instances on the same page don't collide.

Template authoring rules:
  - Use Django template syntax: `{{ var }}`, `{% for %}`, `{% if %}`.
  - Top-level spec keys are directly available as template variables.
  - Auto-escaping is ON — output `|safe` only for trusted HTML strings (e.g., the
    `mermaid_source` field in mermaid components).
  - A unique `instance_id` is auto-injected (string slug like "cp-i-3f2a") for use
    on element ids when the component needs to wire JS to specific DOM nodes.
"""

from __future__ import annotations

import logging
import secrets
from typing import Any

from django.template import Context, Template
from django.template.exceptions import TemplateSyntaxError
from jsonschema import Draft202012Validator, ValidationError, validators

from .registry import Component, get_component

log = logging.getLogger(__name__)


class SpecValidationError(Exception):
    """Raised when spec does not match component schema. Wraps jsonschema errors."""

    def __init__(self, component_id: str, errors: list[str]):
        self.component_id = component_id
        self.errors = errors
        super().__init__(
            f"spec for {component_id!r} failed validation: " + "; ".join(errors)
        )


class RenderError(Exception):
    """Raised when template rendering fails."""


def _strict_validator(schema: dict[str, Any]) -> Draft202012Validator:
    """Build a validator that defaults `additionalProperties: false` everywhere."""

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and "additionalProperties" not in node:
                node["additionalProperties"] = False
            for v in node.values():
                _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    # Don't mutate the registry's copy of the schema; deep-copy via JSON round-trip.
    import copy

    s = copy.deepcopy(schema)
    _walk(s)
    return Draft202012Validator(s)


def validate_spec(component: Component, spec: dict[str, Any]) -> None:
    validator = _strict_validator(component.schema)
    errors = sorted(validator.iter_errors(spec), key=lambda e: list(e.absolute_path))
    if errors:
        msgs = [
            f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
            for e in errors
        ]
        raise SpecValidationError(component.id, msgs)


def _prune_to_schema(schema: Any, value: Any, dropped: list[str], path: str = "") -> Any:
    """Return a copy of ``value`` with keys not declared in ``schema`` removed.

    Mirrors the strict validator's "additionalProperties defaults to false" rule: a
    key the schema doesn't declare (and doesn't explicitly allow) is dropped and its
    dotted path appended to ``dropped``. This lets a component still render when an
    author adds one benign extra key, instead of the whole visual being thrown away —
    real schema errors (missing required fields, wrong types) still surface on the
    post-prune validate.
    """
    if not isinstance(schema, dict):
        return value
    if (schema.get("type") == "object" or "properties" in schema) and isinstance(value, dict):
        props = schema.get("properties", {})
        additional = schema.get("additionalProperties", False)
        allow_extra = additional is True or isinstance(additional, dict)
        out: dict[str, Any] = {}
        for k, v in value.items():
            child = f"{path}.{k}" if path else k
            if k in props:
                out[k] = _prune_to_schema(props[k], v, dropped, child)
            elif allow_extra:
                out[k] = v
            else:
                dropped.append(child)
        return out
    if (schema.get("type") == "array" or "items" in schema) and isinstance(value, list):
        items = schema.get("items")
        if isinstance(items, dict):
            return [_prune_to_schema(items, x, dropped, f"{path}[]") for x in value]
    return value


# Tokens that must never be the LAST word of a clamped label: each opens a phrase
# that the cut discarded, so a label ending on one reads as an unfinished sentence
# ("… slick app great for", "… never the problem the"). Dropping them makes the
# truncation read as deliberate rather than broken.
_DANGLING_TAIL_WORDS = frozenset(
    "a an the and or but for nor so yet with without to of in on at by from into over "
    "under as is are was were be been being that which who whose when while great good "
    "best more most less than vs versus per via plus".split()
)


def _truncate_label(value: str, max_len: int) -> str:
    """Trim ``value`` to ``max_len`` chars so it still reads as a finished label.

    A clamped hero/label field must never render as a mid-sentence fragment — a
    dangling ``(great for``, a trailing ``the``. We reserve room for an ellipsis,
    cut on a word boundary, drop any unfinished trailing clause (an unclosed
    parenthetical, trailing connective/opener words), and append ``…`` so the
    truncation reads as intentional. Callers should still avoid over-long labels;
    this only keeps a clamp from shipping visibly broken.
    """
    if len(value) <= max_len:
        return value
    budget = max(1, max_len - 1)  # leave room for the ellipsis
    cut = value[:budget]
    sp = cut.rfind(" ")
    if sp >= budget - 18:  # honor a word boundary unless it costs too much
        cut = cut[:sp]
    _TRAIL = " ,;:.—–-([{+&/|·"
    cut = cut.rstrip(_TRAIL)
    # A parenthetical opened but never closed inside the kept text is an unfinished
    # clause — drop it whole rather than leave a dangling "(great for".
    op = cut.rfind("(")
    if op != -1 and ")" not in cut[op:]:
        cut = cut[:op].rstrip(_TRAIL)
    # Drop trailing connective/opener words that read as a cut-off clause.
    tokens = cut.split(" ")
    while len(tokens) > 1 and tokens[-1].lower().strip(",.;:—–-()") in _DANGLING_TAIL_WORDS:
        tokens.pop()
    cut = " ".join(tokens).rstrip(_TRAIL)
    return f"{cut}…" if cut else value[: max_len - 1].rstrip() + "…"


def _clamp_to_schema_lengths(
    schema: Any, value: Any, clamped: list[str], path: str = ""
) -> Any:
    """Return a copy of ``value`` with any string longer than its schema
    ``maxLength`` truncated to fit.

    Mirrors ``_prune_to_schema``: an over-long author label (a too-wordy CTA, runner
    name, or context value) renders truncated instead of dropping the whole visual.
    Only declared string fields that carry a ``maxLength`` are touched; every other
    constraint (required fields, types) still surfaces on the post-clamp validate.
    """
    if not isinstance(schema, dict):
        return value
    if schema.get("type") == "string" and isinstance(value, str):
        max_len = schema.get("maxLength")
        if isinstance(max_len, int) and len(value) > max_len:
            clamped.append(path or "<root>")
            return _truncate_label(value, max_len)
        return value
    if (schema.get("type") == "object" or "properties" in schema) and isinstance(value, dict):
        props = schema.get("properties", {})
        out: dict[str, Any] = {}
        for k, v in value.items():
            child = f"{path}.{k}" if path else k
            out[k] = (
                _clamp_to_schema_lengths(props[k], v, clamped, child)
                if k in props
                else v
            )
        return out
    if (schema.get("type") == "array" or "items" in schema) and isinstance(value, list):
        items = schema.get("items")
        if isinstance(items, dict):
            return [_clamp_to_schema_lengths(items, x, clamped, f"{path}[]") for x in value]
    return value


def _coerce_variant_nesting(schema: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    """Nest a variant component's fields under its variant key when an author flattened
    them to the top level.

    Components like intent_hero use a ``variant`` discriminator whose data lives under a
    same-named object (``commercial`` / ``transactional`` / ``navigational``). Authors
    routinely put those fields at the top level, where the prune step then drops them —
    leaving the variant to render empty (e.g. a blank EDITOR'S PICK card). If the active
    variant names a declared object property, move each top-level key that belongs to
    that object's schema under it. A correctly-nested spec has no such stray keys and is
    returned unchanged.
    """
    props = schema.get("properties") or {}
    variant = spec.get("variant")
    if not isinstance(variant, str) or variant not in props:
        return spec
    target = props[variant]
    if not (isinstance(target, dict) and (target.get("type") == "object" or "properties" in target)):
        return spec
    target_props = set((target.get("properties") or {}).keys())
    movable = {k: v for k, v in spec.items() if k in target_props and k not in props}
    if not movable:
        return spec
    nested = dict(spec[variant]) if isinstance(spec.get(variant), dict) else {}
    for k, v in movable.items():
        nested.setdefault(k, v)
    result = {k: v for k, v in spec.items() if k not in movable}
    result[variant] = nested
    return result


def _make_instance_id() -> str:
    return "cp-i-" + secrets.token_hex(4)


def render(
    component_id: str,
    spec: dict[str, Any],
    *,
    instance_id: str | None = None,
    reload: bool = False,
    prune_additional: bool = False,
    dropped_keys: list[str] | None = None,
    clamped_labels: list[str] | None = None,
) -> str:
    """Render a component to HTML.

    Returns the full HTML fragment ready to be embedded in a page. Caller is
    responsible for ensuring page-level dependencies (Chart.js, Mermaid) are
    loaded — check `component.dependencies` from the registry.

    ``prune_additional=True`` first strips any spec keys the schema doesn't declare
    (recording them in ``dropped_keys`` if a list is passed) so one stray key renders
    the visual minus that key instead of dropping the whole component; genuine schema
    errors still raise ``SpecValidationError``.
    """
    component = get_component(component_id, reload=reload)
    if prune_additional:
        spec = _coerce_variant_nesting(component.schema, spec)
        dropped: list[str] = []
        spec = _prune_to_schema(component.schema, spec, dropped)
        if dropped:
            if dropped_keys is not None:
                dropped_keys.extend(dropped)
            log.warning("render %s: pruned unknown spec keys %s", component_id, dropped)
        clamped: list[str] = []
        spec = _clamp_to_schema_lengths(component.schema, spec, clamped)
        if clamped:
            if clamped_labels is not None:
                clamped_labels.extend(clamped)
            log.warning("render %s: clamped over-length spec strings %s", component_id, clamped)
    validate_spec(component, spec)

    iid = instance_id or _make_instance_id()
    ctx = Context({**spec, "instance_id": iid, "component_id": component.id})

    load_prefix = "{% load cp_components %}"

    try:
        rendered = Template(load_prefix + component.template_html).render(ctx)
    except TemplateSyntaxError as exc:
        raise RenderError(f"{component_id}: template.html syntax error: {exc}") from exc

    if component.template_js:
        try:
            js = Template(load_prefix + component.template_js).render(ctx)
        except TemplateSyntaxError as exc:
            raise RenderError(f"{component_id}: template.js syntax error: {exc}") from exc
        rendered += f'\n<script>(function(){{\n{js}\n}})();</script>'

    return rendered
