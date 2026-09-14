"""Dash app factory and gunicorn entry point (`leonardo.web.app:server`)."""

from __future__ import annotations

import os

import dash
import dash_bootstrap_components as dbc

from leonardo.config import Config, load_config
from leonardo.web.callbacks import register_callbacks
from leonardo.web.layout import build_layout


def create_app(config: Config) -> dash.Dash:
    app = dash.Dash(
        __name__, external_stylesheets=[dbc.themes.BOOTSTRAP], title="Leonardo Engine"
    )
    app.layout = build_layout(config)
    register_callbacks(app, config)
    return app


def _default_server():
    return create_app(load_config(os.environ.get("LEONARDO_CONFIG", "config.yml"))).server


# gunicorn imports this module for `server`; tests set LEONARDO_SKIP_SERVER to avoid
# reading config.yml from the working directory at import time.
server = None if os.environ.get("LEONARDO_SKIP_SERVER") else _default_server()
