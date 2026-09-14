"""Pure geometric transforms. Every function returns new arrays."""

from __future__ import annotations

import numpy as np

from leonardo.engine.spline import normalize01, random_spline


def twist(
    a: np.ndarray, b: np.ndarray, along: np.ndarray, turns: float, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
    """Rotate (a, b) by an angle that grows with `along`; 50% chance of no rotation."""
    apply = bool(rng.integers(0, 2))
    fuzzy = bool(rng.integers(0, 2))
    direction = float(rng.choice([-1.0, 1.0]))
    if not apply:
        return a.copy(), b.copy()
    alpha = 2.0 * np.pi * turns * direction * normalize01(along)
    if fuzzy:
        alpha = random_spline(alpha, rng)
    ca, sa = np.cos(alpha), np.sin(alpha)
    return a * ca - b * sa, a * sa + b * ca


def tilt(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    tilt_x: float,
    tilt_y: float,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    """Shift x and y by independent random splines of z."""
    return x + tilt_x * random_spline(z, rng), y + tilt_y * random_spline(z, rng)


def lame(r: np.ndarray, angle: np.ndarray, edginess: float) -> tuple[np.ndarray, np.ndarray]:
    """Superellipse (Lame curve) x, y from radius and angle. edginess=0 is a circle."""
    p = 1.0 / (1.0 + edginess)
    c, s = np.cos(angle), np.sin(angle)
    return r * np.sign(c) * np.abs(c) ** p, r * np.sign(s) * np.abs(s) ** p


def fit_to_print(vertices: np.ndarray, target_height: float) -> np.ndarray:
    """Uniform scale so z-extent == target_height, z-min at 0, xy centred at origin."""
    v = np.asarray(vertices, dtype=float)
    lo, hi = v.min(axis=0), v.max(axis=0)
    height = hi[2] - lo[2]
    if height <= 0:
        raise ValueError("degenerate design: zero height")
    scale = target_height / height
    centre = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    return (v - centre) * scale
