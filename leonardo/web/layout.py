"""Dash layout: sidebar card with actions, 3D preview, author card."""

from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from leonardo.config import Config


def hidden_axis() -> dict:
    return {
        "showbackground": False,
        "title": "",
        "showticklabels": False,
        "showgrid": False,
        "zeroline": False,
        "showspikes": False,
    }


def empty_figure(config: Config) -> dict:
    fig = config.app["figure"]
    return {
        "data": [{"type": "mesh3d", "x": [], "y": [], "z": [], "i": [], "j": [], "k": []}],
        "layout": {
            "height": fig["height"],
            "margin": fig["margin"],
            "scene": {"xaxis": hidden_axis(), "yaxis": hidden_axis(), "zaxis": hidden_axis()},
        },
    }


def build_layout(config: Config) -> dbc.Container:
    card = dbc.Card(
        dbc.CardBody(
            [
                dbc.CardImg(src="/assets/sample02.jpg", top=True),
                html.H4("Generative Design Engine Leonardo", className="card-title mt-3"),
                html.P("Create unique, print-ready 3D designs.", className="card-text"),
                html.Div(
                    [
                        dbc.Button("Design", id="generate", n_clicks=0, outline=True, color="dark"),
                        dbc.Button(
                            "Download 3MF",
                            id="download-button",
                            n_clicks=0,
                            outline=True,
                            color="primary",
                        ),
                    ],
                    className="d-grid gap-2",
                ),
                html.Small(id="seed-label", className="text-muted d-block mt-2"),
                dbc.Alert(id="error", color="danger", is_open=False, className="mt-2"),
            ]
        )
    )
    author = dbc.Card(
        dbc.CardBody(
            [
                html.H4("About", className="card-title"),
                html.P(
                    [
                        ("Physicist with a passion for leadership as well as tackling complex "
                        "technical and cultural challenges. Lets connect @ "),
                        html.A("LinkedIn", href=config.app["linkedin"], target="_blank"),
                    ],
                    className="card-text",
                ),
            ]
        ),
        className="mt-3",
    )
    graph = dcc.Loading(
        dcc.Graph(id="graph", figure=empty_figure(config), config={"displayModeBar": False}),
        type="dot",
        color=config.app["figure"]["color"],
    )
    return dbc.Container(
        [
            dcc.Store(id="design-store"),
            dcc.Download(id="download"),
            dbc.Row([dbc.Col([card, author], md=4, className="py-3"), dbc.Col(graph, md=8)]),
        ],
        fluid=True,
    )
