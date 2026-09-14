"""Draw a concrete parameter set from the config parameter space."""

from __future__ import annotations

import numpy as np

from leonardo.config import Config


def generate_parameters(config: Config, model: str, rng: np.random.Generator) -> dict:
    mc = config.models[model]
    params: dict = {}
    for key, val in mc.parameters.items():
        if isinstance(val, tuple):
            params[key] = float(rng.uniform(val[0], val[1]))
        else:
            params[key] = int(val) if key == "num_points" else float(val)
    params["phi_texture_type"] = int(rng.integers(mc.num_texture_types))
    second = "z" if model == "csym" else "theta"
    params[f"{second}_texture_type"] = int(rng.integers(mc.num_texture_types))
    return params
