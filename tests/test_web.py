import dataclasses

import pytest
from dash.exceptions import PreventUpdate

from leonardo.config import load_config
from leonardo.web.app import create_app
from leonardo.web.callbacks import on_design, on_download


@pytest.fixture(scope="module")
def cfg(config_path):
    c = load_config(config_path)
    return dataclasses.replace(c, app={**c.app, "preview_points": 30})


def test_app_builds(cfg):
    app = create_app(cfg)
    assert app.title == "Leonardo Engine"


def test_design_returns_figure_and_store(cfg):
    fig, store, label = on_design(1, cfg)
    assert fig["data"][0]["type"] == "mesh3d"
    assert set(store) == {"seed", "model"}
    assert str(store["seed"]) in label


def test_design_prevent_update_on_zero(cfg):
    with pytest.raises(PreventUpdate):
        on_design(0, cfg)


def test_download_regenerates_from_store(cfg):
    _, store, _ = on_design(1, cfg)
    out = on_download(1, store, cfg)
    assert out["filename"] == f"{store['seed']}_{store['model']}.3mf"
    assert out["base64"] is True


def test_download_prevent_update_without_store(cfg):
    with pytest.raises(PreventUpdate):
        on_download(1, None, cfg)
