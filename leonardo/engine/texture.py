"""Periodic surface textures: 1 + amplitude * wave(frequency * t)."""

from __future__ import annotations

import numpy as np
from scipy import signal


def texture(
    t: np.ndarray,
    kind: int,
    amplitude: float,
    frequency: float,
    duty_cycle: float,
    rng: np.random.Generator,
) -> np.ndarray:
    """kind: 0 sine, 1 sawtooth, 2 square, 3 gausspulse (random carrier frequency)."""
    w = frequency * t
    if kind == 0:
        wave = np.sin(w)
    elif kind == 1:
        wave = signal.sawtooth(w, duty_cycle)
    elif kind == 2:
        wave = signal.square(w, duty_cycle)
    elif kind == 3:
        wave = signal.gausspulse(w, fc=float(rng.integers(2, 20)))
    else:
        raise ValueError(f"unknown texture kind {kind}")
    return 1.0 + amplitude * np.asarray(wave, dtype=float)
