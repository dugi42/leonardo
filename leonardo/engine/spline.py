"""Random B-spline modulators (replaces sklearn SplineTransformer)."""

from __future__ import annotations

import numpy as np
from scipy.interpolate import BSpline


def random_spline(
    t: np.ndarray, rng: np.random.Generator, degree_max: int = 5, knots_max: int = 7
) -> np.ndarray:
    """Evaluate a B-spline with random degree, knot count and coefficients in [-1, 1] at t."""
    degree = int(rng.integers(1, degree_max + 1))
    n_knots = int(rng.integers(2, knots_max + 1))
    tmin, tmax = float(t.min()), float(t.max())
    if tmax <= tmin:
        return np.zeros_like(t, dtype=float)
    inner = np.linspace(tmin, tmax, n_knots)
    knots = np.concatenate([np.full(degree, tmin), inner, np.full(degree, tmax)])
    coef = rng.uniform(-1.0, 1.0, size=len(knots) - degree - 1)
    return BSpline(knots, coef, degree, extrapolate=True)(t)


def normalize01(a: np.ndarray) -> np.ndarray:
    """Min-max scale to [0, 1]; a constant array maps to zeros."""
    lo, hi = float(a.min()), float(a.max())
    if hi <= lo:
        return np.zeros_like(a, dtype=float)
    return (a - lo) / (hi - lo)
