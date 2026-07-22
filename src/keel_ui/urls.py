"""URL routes for the public component library showcase: `/component-library/`."""

from __future__ import annotations

from django.urls import path

from . import views

app_name = "component_library"

urlpatterns = [
    path("", views.LibraryIndexView.as_view(), name="index"),
    path("<slug:component_id>/", views.ComponentDetailView.as_view(), name="detail"),
]
