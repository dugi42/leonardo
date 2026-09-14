"""Design container, generation entry point, watertight check and export."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh

from leonardo.config import Config
from leonardo.engine.models import MODELS
from leonardo.engine.params import generate_parameters
from leonardo.engine.transforms import fit_to_print

FORMATS = ("stl", "3mf")


class MeshError(RuntimeError):
    def __init__(self, seed: int, model: str, reason: str):
        super().__init__(f"seed {seed} model {model}: {reason}")
        self.seed = seed
        self.model = model


@dataclass(frozen=True)
class Design:
    seed: int
    model: str
    parameters: dict
    vertices: np.ndarray  # (N, 3) millimetres
    faces: np.ndarray  # (M, 3) vertex indices

    @property
    def stem(self) -> str:
        return f"{self.seed}_{self.model}"

    def to_trimesh(self) -> trimesh.Trimesh:
        return trimesh.Trimesh(self.vertices, self.faces, process=False)


def pick_model(rng: np.random.Generator) -> str:
    names = sorted(MODELS)
    return names[int(rng.integers(len(names)))]


def generate(
    config: Config, seed: int, model: str = "random", num_points: int | None = None
) -> Design:
    """Build a watertight, print-scaled design. Same seed always gives the same design."""
    rng = np.random.default_rng(seed)
    if model == "random":
        model = pick_model(rng)
    if model not in MODELS:
        raise ValueError(f"unknown model {model!r}; choose from {sorted(MODELS)}")
    params = generate_parameters(config, model, rng)
    if num_points is not None:
        params["num_points"] = int(num_points)
    vertices, faces = MODELS[model](params, config.print, rng)
    if not np.all(np.isfinite(vertices)):
        raise MeshError(seed, model, "non-finite vertices")
    vertices = fit_to_print(
        vertices, config.print.target_height_mm, config.print.max_footprint_mm
    )
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    if not mesh.is_watertight or not mesh.is_winding_consistent:
        raise MeshError(seed, model, "not watertight")
    if mesh.volume < 0:
        faces = np.ascontiguousarray(faces[:, ::-1])
        mesh = trimesh.Trimesh(vertices, faces, process=False)
    if mesh.volume <= 0:
        raise MeshError(seed, model, "zero volume")
    return Design(seed=seed, model=model, parameters=params, vertices=vertices, faces=faces)


def export_bytes(design: Design, fmt: str) -> bytes:
    if fmt not in FORMATS:
        raise ValueError(f"unknown format {fmt!r}; choose from {FORMATS}")
    data = design.to_trimesh().export(file_type=fmt)
    return data if isinstance(data, bytes) else data.encode()


def export(design: Design, out_dir: Path, formats: Iterable[str] = FORMATS) -> list[Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for fmt in formats:
        path = out_dir / f"{design.stem}.{fmt}"
        path.write_bytes(export_bytes(design, fmt))
        paths.append(path)
    return paths
