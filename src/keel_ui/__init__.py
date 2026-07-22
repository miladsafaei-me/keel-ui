"""keel-ui: a typed catalog of themeable visual content components + a renderer.

The library owns two extraction-critical artifacts a content pipeline consumes:

  * the **registry** — component discovery + per-component JSON Schema, and
  * the **renderer** — turns a ``(component_id, spec)`` pair into final HTML.

Public surface::

    from keel_ui import (
        render, get_component, iter_components, load_registry,
        Component, ComponentNotFound, RenderError, SpecValidationError,
    )

The registry scans the packaged ``components/<category>/<id>/`` folders (see
``keel_ui.paths.components_root``). The renderer validates a spec against the
component's schema, then renders its ``template.html`` (Django template engine)
and inlines any ``template.js``.
"""

from .registry import (
    Component,
    ComponentNotFound,
    get_component,
    iter_components,
    load_registry,
)
from .renderer import RenderError, SpecValidationError, render

__all__ = [
    "Component",
    "ComponentNotFound",
    "RenderError",
    "SpecValidationError",
    "get_component",
    "iter_components",
    "load_registry",
    "render",
]

__version__ = "0.1.0"
