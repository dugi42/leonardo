import numpy as np
import pytest

from leonardo.engine.transforms import fit_to_print, lame, tilt, twist


def test_fit_to_print():
    v = np.array([[1, 2, 3], [3, 6, 7], [2, 4, 5.0]])
    out = fit_to_print(v, 100.0)
    assert np.isclose(out[:, 2].max() - out[:, 2].min(), 100.0)
    assert np.isclose(out[:, 2].min(), 0.0)
    assert np.isclose((out[:, 0].max() + out[:, 0].min()) / 2, 0.0)
    assert np.isclose((out[:, 1].max() + out[:, 1].min()) / 2, 0.0)
    assert v[0, 0] == 1  # input untouched


def test_fit_to_print_zero_height_raises():
    with pytest.raises(ValueError):
        fit_to_print(np.zeros((3, 3)), 100.0)


def test_lame_zero_edginess_is_circle():
    ang = np.linspace(0, 2 * np.pi, 50, endpoint=False)
    x, y = lame(np.full(50, 2.0), ang, 0.0)
    np.testing.assert_allclose(x, 2 * np.cos(ang), atol=1e-12)
    np.testing.assert_allclose(y, 2 * np.sin(ang), atol=1e-12)


def test_twist_preserves_radius_and_inputs():
    a = np.linspace(1, 2, 20)
    b = np.zeros(20)
    z = np.linspace(0, 1, 20)
    a0 = a.copy()
    # try several seeds so at least one applies a rotation
    rotated = False
    for seed in range(8):
        a2, b2 = twist(a, b, z, 1.5, np.random.default_rng(seed))
        np.testing.assert_allclose(np.hypot(a2, b2), np.hypot(a, b))
        rotated |= not np.allclose(a2, a)
    assert rotated
    np.testing.assert_array_equal(a, a0)


def test_tilt_shifts_by_function_of_z():
    rng = np.random.default_rng(3)
    x = np.zeros(30)
    y = np.zeros(30)
    z = np.repeat(np.linspace(0, 1, 10), 3)
    x2, y2 = tilt(x, y, z, 5.0, 0.0, rng)
    np.testing.assert_array_equal(y2, y)
    assert np.allclose(x2[0:3], x2[0])  # same z -> same shift
    assert not np.allclose(x2, 0)
