import numpy as np
import pytest

from leonardo.config import load_config
from leonardo.engine import MODELS, MeshError, generate

SEEDS = list(range(50))


@pytest.fixture(scope="module")
def cfg(config_path):
    return load_config(config_path)


@pytest.mark.parametrize("model", sorted(MODELS))
@pytest.mark.parametrize("seed", SEEDS)
def test_watertight_and_scaled(cfg, model, seed):
    d = generate(cfg, seed, model, num_points=60)
    m = d.to_trimesh()
    assert m.is_watertight, f"{model} seed {seed} not watertight"
    assert m.is_winding_consistent
    assert m.volume > 0
    ext = d.vertices.max(axis=0) - d.vertices.min(axis=0)
    assert ext[2] <= cfg.print.target_height_mm + 1e-6
    assert ext[:2].max() <= cfg.print.max_footprint_mm + 1e-6
    assert np.isclose(ext[2], cfg.print.target_height_mm) or np.isclose(
        ext[:2].max(), cfg.print.max_footprint_mm
    )
    assert np.isclose(d.vertices[:, 2].min(), 0.0, atol=1e-6)


@pytest.mark.parametrize("model", sorted(MODELS))
def test_deterministic(cfg, model):
    a = generate(cfg, 123, model, num_points=40)
    b = generate(cfg, 123, model, num_points=40)
    np.testing.assert_array_equal(a.vertices, b.vertices)
    np.testing.assert_array_equal(a.faces, b.faces)
    assert a.parameters == b.parameters


def test_random_model_is_seeded(cfg):
    assert generate(cfg, 5, num_points=30).model == generate(cfg, 5, num_points=30).model


def test_preview_and_full_share_parameters(cfg):
    a = generate(cfg, 9, "csym", num_points=30)
    b = generate(cfg, 9, "csym", num_points=90)
    strip = lambda d: {k: v for k, v in d.items() if k != "num_points"}
    assert strip(a.parameters) == strip(b.parameters)


def test_unknown_model_raises(cfg):
    with pytest.raises(ValueError):
        generate(cfg, 1, "nope")


def test_mesh_error_type():
    err = MeshError(3, "csym", "not watertight")
    assert err.seed == 3 and err.model == "csym" and "watertight" in str(err)


@pytest.mark.parametrize("seed", SEEDS)
def test_rsym_is_volume(cfg, seed):
    assert generate(cfg, seed, "rsym", num_points=60).to_trimesh().is_volume


@pytest.mark.parametrize("seed", SEEDS[:20])
def test_csym_seam_is_not_special(cfg, seed):
    n = 60
    v = generate(cfg, seed, "csym", num_points=n).vertices[: n * n].reshape(n, n, 3)
    seam = np.linalg.norm(v[:, 0] - v[:, -1], axis=1).max()
    neighbour = np.linalg.norm(np.diff(v, axis=1), axis=2).max()
    assert seam <= neighbour * 1.05
