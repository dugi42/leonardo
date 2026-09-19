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
    wrap: bool = False,
) -> np.ndarray:
    """kind: 0 sine, 1 sawtooth, 2 square, 3 gausspulse train (random carrier frequency).

    All waves are 2*pi-periodic in `frequency * t`. With `wrap=True` the frequency is
    rounded to an integer so a full turn of t in [0, 2*pi) closes without a seam.
    """
    if wrap:
        frequency = float(round(frequency))
    w = frequency * t
    if kind == 0:
        wave = np.sin(w)
    elif kind == 1:
        wave = signal.sawtooth(w, duty_cycle)
    elif kind == 2:
        wave = signal.square(w, duty_cycle)
    elif kind == 3:
        # gausspulse is a single pulse at 0; driving it with a triangle wave repeats
        # it every period instead of leaving one spike at t = 0.
        wave = signal.gausspulse(signal.sawtooth(w, 0.5), fc=float(rng.integers(2, 20)))
    else:
        raise ValueError(f"unknown texture kind {kind}")
    return 1.0 + amplitude * np.asarray(wave, dtype=float)
