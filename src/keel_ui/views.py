"""Views for the public component library: a sidebar + detail Storybook-style page.

The index view shows the first component of the first category by default; users
navigate via the sidebar to other components. Each detail page shows:

  - the rendered component (using example.json),
  - a brief description (when_to_pick),
  - the manifest (id, category, version, tags, dependencies),
  - the JSON Schema for the spec,
  - the example spec used to render this preview,
  - the raw HTML output of the renderer (for editors who want to copy).
"""

from __future__ import annotations

import json
from typing import Any

from django.conf import settings
from django.http import Http404
from django.utils.safestring import mark_safe
from django.views.generic import TemplateView

from . import registry as reg_mod
from . import renderer


def _should_reload(request) -> bool:
    return bool(settings.DEBUG and request.GET.get("reload"))


def _sidebar_context(reg: reg_mod.Registry, current_id: str | None) -> dict[str, Any]:
    categories: list[dict[str, Any]] = []
    for cat, comps in reg.iter_categories():
        categories.append(
            {
                "slug": cat,
                "label": cat.replace("-", " ").title(),
                "components": [
                    {
                        "id": c.id,
                        "url_slug": c.slug,
                        "name": c.name,
                        "active": c.id == current_id,
                    }
                    for c in comps
                ],
            }
        )
    return {"sidebar_categories": categories, "total_count": len(reg.components)}


def _has_dependency(reg: reg_mod.Registry, dep: str) -> bool:
    return any(dep in c.dependencies for c in reg.components.values())


class LibraryIndexView(TemplateView):
    template_name = "component_library/index.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        reg = reg_mod.load_registry(reload=_should_reload(self.request))
        ctx.update(_sidebar_context(reg, current_id=None))
        ctx["empty"] = not reg.components
        ctx["chartjs_needed"] = _has_dependency(reg, "chartjs")
        ctx["mermaid_needed"] = _has_dependency(reg, "mermaid")
        return ctx


class ComponentDetailView(TemplateView):
    template_name = "component_library/detail.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        reg = reg_mod.load_registry(reload=_should_reload(self.request))
        # URL uses hyphenated form (site-wide convention enforced by middleware).
        # Convert back to canonical underscore id for registry lookup.
        url_slug = kwargs["component_id"]
        component_id = url_slug.replace("-", "_")

        try:
            component = reg.components[component_id]
        except KeyError as exc:
            raise Http404(f"component {component_id!r} not found") from exc

        try:
            rendered = renderer.render(component.id, component.example, reload=False)
            render_error = None
        except (renderer.SpecValidationError, renderer.RenderError) as exc:
            rendered = ""
            render_error = str(exc)

        ctx.update(_sidebar_context(reg, current_id=component.id))
        ctx["component"] = component
        ctx["rendered_html"] = mark_safe(rendered)
        ctx["rendered_raw"] = rendered
        ctx["render_error"] = render_error
        ctx["manifest_json"] = json.dumps(
            {
                "id": component.id,
                "name": component.name,
                "category": component.category,
                "version": component.version,
                "when_to_pick": component.when_to_pick,
                "tags": list(component.tags),
                "audience_fit": list(component.audience_fit),
                "dependencies": list(component.dependencies),
            },
            indent=2,
            ensure_ascii=False,
        )
        ctx["schema_json"] = json.dumps(component.schema, indent=2, ensure_ascii=False)
        ctx["example_json"] = json.dumps(component.example, indent=2, ensure_ascii=False)
        ctx["chartjs_needed"] = "chartjs" in component.dependencies
        ctx["mermaid_needed"] = "mermaid" in component.dependencies
        return ctx
