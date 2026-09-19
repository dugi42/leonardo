import numpy as np

from leonardo.engine.spline import normalize01, random_spline


def test_deterministic_and_shape():
    t = np.linspace(0, 10, 200)
    a = random_spline(t, np.random.default_rng(7))
    b = random_spline(t, np.random.default_rng(7))
    assert a.shape == t.shape
    np.testing.assert_array_equal(a, b)
    assert np.all(np.isfinite(a))


def test_different_seeds_differ():
    t = np.linspace(0, 10, 200)
    a = random_spline(t, np.random.default_rng(1))
    b = random_spline(t, np.random.default_rng(2))
    assert not np.allclose(a, b)


def test_constant_input_is_finite():
    t = np.zeros(10)
    assert np.all(np.isfinite(random_spline(t, np.random.default_rng(0))))


def test_normalize01():
    np.testing.assert_allclose(normalize01(np.array([2.0, 4.0, 6.0])), [0, 0.5, 1])
    np.testing.assert_array_equal(normalize01(np.ones(3)), np.zeros(3))
