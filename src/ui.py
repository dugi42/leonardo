"""
This module contains the Dash app for the Leonardo engine.
The app allows users to generate unique 3D designs and export them as STL files.
The app is created using the Dash framework and uses Plotly for visualization. 
The app consists of an initial loading screen with a loader animation and a jumbotron with a "GO!" button to generate a new design.
The app also includes a checkbox to export the design as an STL file.
The app is created using the create_app() function, which initializes the figure and creates the layout of the app.
The update_figure() function updates the figure according to new geometry data.
The hide_axis() function hides axis information in the 3D-mesh plot.
The init_figure() function initializes the figure for the initial loading screen.
The get_ijk() function returns the indices of the triangles in the triangulation.
The design() function generates a new 3D design using the Leonardo engine. 
The export_stl() function exports the design as an STL file. 
"""

from typing import Tuple, List
import numpy as np
import matplotlib.tri as mtri
import base64
import datetime

from plotly import graph_objs as go
import dash
from dash import dcc, html
from dash.dependencies import Input, Output, State
import dash_bootstrap_components as dbc

from src.engine import get_ijk, design, export_stl


def hide_axis() -> dict:
    """Hides axis information in plotly 3D-mesh plot.

    Returns:
        dict: Axis configuration.
    """
    # Switch off all axis information
    axis_config = dict(
        showbackground=False,
        title='',
        showticklabels=False,
        showgrid=False,
        zeroline=False,
        showspikes=False
    )

    return axis_config


def init_figure(config: dict) -> dcc.Loading:
    """Initializes figure for dash app inital loading.

    Args:
        config (dict): Contains the app configuration.

    Returns:
        dcc.Graph: Returns the dash core components graph.
    """

    color = config["app"]["figure"]["color"]
    # Create empty mesh
    mesher = go.Mesh3d(
        x=[],
        y=[],
        z=[],
        i=[],
        j=[],
        k=[]
    ) # type: ignore

    # Create empty layout
    layout = go.Layout(
        margin=config["app"]["figure"]["margin"],
        scene=dict(
            xaxis=hide_axis(),
            yaxis=hide_axis(),
            zaxis=hide_axis()
        )
    ) # type: ignore

    # Create init figure with loader animation
    figure = dcc.Loading(
        [dcc.Graph(
            id='graph',
            figure={
                'data': [mesher],
                'layout': layout
            },
            config={
                'displayModeBar': False,
                'auto_open': False
            }
        )
        ],
        type='dot',
        color=color
    )

    return figure


def update_figure(geometry: Tuple[np.ndarray, np.ndarray, np.ndarray, mtri.triangulation.Triangulation], config: dict) -> dict:
    """Updates the figure according to new geometry data.

    Args:
        geometry (Tuple[np.array, np.array, np.array, mtri.triangulation.Triangulation]):
        x,y,z- coordinates of the design as well as the corresponding trianglations.
        config (dict): Config of the paramter space read from the yaml file.

    Returns:
        dict: Figure dictionary
    """

    # Unpack geometry
    x, y, z, triangles = geometry
    i, j, k = get_ijk(triangles)

    color = config["app"]["figure"]["color"]
    colorscale = [[0, color], [1, color]]

    # Update mesh
    update_data = go.Mesh3d(
        x=x,
        y=y,
        z=z,
        i=i,
        j=j,
        k=k,
        intensity=z,
        hoverinfo='none',
        flatshading=True,
        colorscale=colorscale,
        showscale=False,
        lighting=config["app"]["figure"]["lighting"],
        lightposition=config["app"]["figure"]["lightposition"],
    ) # type: ignore

    # Update layout
    update_layout = go.Layout(
        height=config["app"]["figure"]["height"],
        margin=config["app"]["figure"]["margin"],
        scene=dict(xaxis=hide_axis(),
                   yaxis=hide_axis(),
                   zaxis=hide_axis()),
        scene_aspectmode='data'
    ) # type: ignore

    # Update configuration
    update_config = {
        'displayModeBar': False,
        'auto_open': False
    }

    # Combine information
    update = {
        'data': [update_data],
        'layout': update_layout,
        'config': update_config}

    return update


def create_app(config: dict) -> dash.Dash:
    """Create the dash app.

    Args:
        geometry (Tuple[np.array, np.array, np.array, mtri.triangulation.Triangulation]):
        x,y,z- coordinates of the design as well as the corresponding trianglations.
        config (dict): Config of the paramter space read from the yaml file.

   Returns:
        dash.App: The dash app.
    """
    # Initialize figure
    figure = init_figure(config)

    
    # the style arguments for the sidebar. We use position:fixed and a fixed width

    card_png = './imgs/sample02.jpg'
    card_base64 = base64.b64encode(open(card_png, 'rb').read()).decode('ascii')

    card = dbc.Card(
        [
            dbc.CardBody(
                [
                    dbc.CardImg(src=f'data:image/png;base64,{card_base64}', top=True),
                    html.H4("Generative Design Engine Leonardo", className="card-title"),
                    html.P(
                        "Create unique 3D designs.",
                        className="card-text",
                    ),
                html.Div([
                    dbc.Button('Design', id='generate', n_clicks=0, outline=True, color="dark"),
                    dbc.Button('Download file', id='download-button',n_clicks=0, outline=True, color="primary"),
                ],className="d-grid gap-2",
                ),
                ]
            ),
        ],
        #style={"width": "18rem"},
    )
    # Create author card
    author = dbc.Card(
        [
            dbc.Row(
                [
                dbc.CardBody(
                    [
                        html.H4("About", className="card-title"),
                        html.P(
                            ["Physicist with a passion for leadership as well as tackling complex technical and cultural challenges. ",
                            "Lets connect @ ",
                            html.A('LinkedIn', href=config["app"]["linkedin"], target="_blank"),],
                            className="card-text",
                        ),
                        html.Small(
                            f"Last updated  {datetime.datetime.now().strftime('%B %d, %Y')}",
                            className="card-text text-muted",
                        ),
                    ]
                ),
                ],
                className="g-0 d-flex align-items-center",
            )
        ],
        className="mb-3",
        style={"maxWidth": "540px"},
    )
    
    # Create sidebar
    sidebar = html.Div(
        [
            card,
            dcc.Download(id='download'),
            author
    
        ],
        style=config["app"]["sidebar"]["style"],
    )



    # Create app
    app = dash.Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])
    app.title = 'Leonardo Engine'
    app.layout = html.Div(children=[
                                dbc.Container(children=[
                                                dbc.Row([
                                                dbc.Col([sidebar]), 
                                                dbc.Col([figure], style={"margin-left": "-35rem"},),
                                                ], align="center"),
                                                ]),
                                ])
    
    app._favicon = "./assets/favicon.ico"

    return app



def create_callbacks(app: dash.Dash, config: dict) -> List[dict]: # type: ignore
    """Create the app callbacks the app.

    Args:
        app (dash.Dash): Dash app.
        config (dict): Config of the paramter space read from the yaml file.

    Returns:
        List[dict]: Returns the updated figure with a random design.
    """

    # Button click callback for the design generation.
    @app.callback([Output('graph', 'figure')],
                  [Input('generate', 'n_clicks')])
    def update(generate_button): # type: ignore
        # Select random model
        model = np.random.choice([
            "csym",
            "rsym",
        ])

        # Generate the geometry
        geometry = design(config, model)
        update_graph = update_figure(geometry, config)
        x, y, z, triangles = geometry
        
        if generate_button is not None and generate_button > 0:
            export_stl('export.stl', x, y, z, triangles)
        return [update_graph]
    
    
    @app.callback([Output('download', 'data')],
                  [Input('download-button', 'n_clicks')])
    def update(download_button):
        if download_button is not None and download_button > 0:
            return [dcc.send_file('export.stl')]
    
    

def run_app(config: dict) -> dash.Dash:
    """Create the app, callbacks and runs the server

    Args:
        config (dict): Config of the paramter space read from the yaml file.

    Returns:
        dash.App: The dash app.
    """
    # Initialize app
    app = create_app(config)

    # Create callbacks
    create_callbacks(
        app,
        config
    )

    return app
