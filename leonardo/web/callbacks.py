"""Dash callbacks. `on_design` / `on_download` are plain functions for unit tests."""

from __future__ import annotations

import base64

import numpy as np
from dash import Input, Output, State, no_update
from dash.exceptions import PreventUpdate

from leonardo.config import Config
from leonardo.engine import Design, MeshError, export_bytes, generate
from leonardo.web.layout import hidden_axis

RETRIES = 3
MIME_3MF = "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"


def mesh_figure(design: Design, config: Config) -> dict:
    fig = config.app["figure"]
    v, f = design.vertices, design.faces
    color = fig["color"]
    return {
        "data": [
            {
                "type": "mesh3d",
                "x": v[:, 0],
                "y": v[:, 1],
                "z": v[:, 2],
                "i": f[:, 0],
                "j": f[:, 1],
                "k": f[:, 2],
                "intensity": v[:, 2],
                "colorscale": [[0, color], [1, color]],
                "showscale": False,
                "flatshading": True,
                "hoverinfo": "none",
                "lighting": fig["lighting"],
                "lightposition": fig["lightposition"],
            }
        ],
        "layout": {
            "height": fig["height"],
            "margin": fig["margin"],
            "scene": {
                "xaxis": hidden_axis(),
                "yaxis": hidden_axis(),
                "zaxis": hidden_axis(),
                "aspectmode": "data",
            },
        },
    }


def on_design(n_clicks: int | None, config: Config) -> tuple[dict, dict, str]:
    """Draw a random seed, build a preview-resolution design, return figure + store."""
    if not n_clicks:
        raise PreventUpdate
    rng = np.random.default_rng()
    last: MeshError | None = None
    for _ in range(RETRIES):
        seed = int(rng.integers(2**31))
        try:
            design = generate(config, seed, "random", num_points=int(config.app["preview_points"]))
        except MeshError as err:
            last = err
            continue
        return (
            mesh_figure(design, config),
            {"seed": design.seed, "model": design.model},
            f"seed {design.seed} · model {design.model}",
        )
    assert last is not None
    raise last


def on_download(n_clicks: int | None, store: dict | None, config: Config) -> dict:
    """Regenerate the stored seed at full resolution and return a 3MF download payload."""
    if not n_clicks or not store:
        raise PreventUpdate
    design = generate(config, int(store["seed"]), store["model"])
    data = export_bytes(design, "3mf")
    return {
        "content": base64.b64encode(data).decode(),
        "filename": f"{design.stem}.3mf",
        "base64": True,
        "type": MIME_3MF,
    }


def register_callbacks(app, config: Config) -> None:
    @app.callback(
        Output("graph", "figure"),
        Output("design-store", "data"),
        Output("seed-label", "children"),
        Output("error", "children"),
        Output("error", "is_open"),
        Input("generate", "n_clicks"),
        prevent_initial_call=True,
    )
    def _design(n_clicks):
        try:
            fig, store, label = on_design(n_clicks, config)
        except MeshError as err:
            return no_update, no_update, no_update, str(err), True
        return fig, store, label, "", False

    @app.callback(
        Output("download", "data"),
        Input("download-button", "n_clicks"),
        State("design-store", "data"),
        prevent_initial_call=True,
    )
    def _download(n_clicks, store):
        return on_download(n_clicks, store, config)
