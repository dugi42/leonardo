import numpy as np
import pytest

from leonardo.engine.texture import texture


@pytest.mark.parametrize("kind", [0, 1, 2, 3])
def test_texture_bounds(kind):
    t = np.linspace(0, 2 * np.pi, 500)
    rng = np.random.default_rng(0)
    out = texture(t, kind, amplitude=0.2, frequency=3.0, duty_cycle=0.5, rng=rng)
    assert out.shape == t.shape
    assert np.all(out >= 0.8 - 1e-9) and np.all(out <= 1.2 + 1e-9)


def test_zero_amplitude_is_flat():
    t = np.linspace(0, 1, 50)
    out = texture(t, 1, 0.0, 5.0, 0.3, np.random.default_rng(0))
    np.testing.assert_array_equal(out, np.ones(50))


def test_unknown_kind_raises():
    with pytest.raises(ValueError):
        texture(np.zeros(3), 9, 0.1, 1.0, 0.5, np.random.default_rng(0))


@pytest.mark.parametrize("kind", [0, 1, 2, 3])
def test_wrap_closes_seam(kind):
    t = np.linspace(0, 2 * np.pi, 400, endpoint=False)
    out = texture(t, kind, 1.0, 4.5, 0.5, np.random.default_rng(0), wrap=True)
    step = np.abs(np.diff(out))
    assert abs(out[0] - out[-1]) <= step.max() + 1e-9


def test_gausspulse_repeats_along_t():
    t = np.linspace(0, 2 * np.pi, 400, endpoint=False)
    out = texture(t, 3, 1.0, 5.0, 0.5, np.random.default_rng(0))
    assert (np.abs(out - 1) > 0.01).mean() > 0.1
    assert np.sum(np.abs(out[100:] - 1) > 0.01) > 0  # not a single spike at t = 0
