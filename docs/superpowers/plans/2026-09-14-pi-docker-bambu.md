# Leonardo Pi/Docker/Bambu Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Leonardo engine so it produces watertight, mm-scaled STL/3MF meshes, runs as a Dash web app and a CLI, and ships as one multi-arch Docker image for Raspberry Pi 4/5.

**Architecture:** New `leonardo/` package. `engine/` builds vertices on a structured parametric grid and triangulates by index (wrap + fan caps), applies pure transforms driven by an explicit `numpy.random.Generator`, fits the result to a print height, and exports via trimesh. `cli.py` and `web/` are thin consumers of `engine.generate()`.

**Tech Stack:** Python 3.12, numpy, scipy (BSpline, signal), trimesh (STL/3MF export, watertight check), dash 4 + dash-bootstrap-components, plotly, pyyaml, gunicorn, pytest, ruff, Docker buildx.

**Spec:** `docs/superpowers/specs/2026-09-13-pi-docker-bambu-design.md`

## Global Constraints

- Python `>=3.11`; Docker base `python:3.12-slim-bookworm`; image built for `linux/arm64,linux/amd64`.
- `pip install --only-binary=:all:` in the Dockerfile; no compiler in the image.
- No `np.random.*` module-level calls; every random draw goes through an explicit `rng: numpy.random.Generator`.
- Transform functions never mutate their inputs.
- Output file names: `<seed>_<model>.stl` and `<seed>_<model>.3mf`.
- Config keys added: `print.target_height_mm` (100), `print.min_radius_mm` (1.0), `app.preview_points` (120).
- Every generated mesh must satisfy `trimesh.Trimesh.is_watertight`, `is_winding_consistent`, `volume > 0`.
- Delete: `src/`, `app.py`, `Procfile`, `environment.yml`, `requirements.txt`, `.github/workflows/main_leonardoengine.yml`.

---

## File map

| Path | Responsibility |
|---|---|
| `pyproject.toml` | package metadata, deps, `leonardo` console script, pytest/ruff config |
| `config.yml` | parameter space, print settings, app settings |
| `leonardo/config.py` | `load_config(path) -> Config`, `ConfigError` |
| `leonardo/engine/grid.py` | `make_grid`, `grid_faces`, `cap_faces` |
| `leonardo/engine/spline.py` | `random_spline(t, rng, ...)` |
| `leonardo/engine/texture.py` | `texture(t, kind, amplitude, frequency, duty_cycle, rng)` |
| `leonardo/engine/transforms.py` | `twist`, `tilt`, `lame`, `fit_to_print` |
| `leonardo/engine/params.py` | `generate_parameters(config, model, rng)` |
| `leonardo/engine/models.py` | `design_csym`, `design_rsym`, `MODELS` |
| `leonardo/engine/mesh.py` | `Design`, `MeshError`, `generate`, `export` |
| `leonardo/engine/__init__.py` | re-exports `generate`, `export`, `Design`, `MeshError`, `MODELS` |
| `leonardo/cli.py` | `main(argv)`: `generate`, `serve` |
| `leonardo/web/app.py` | `create_app(config) -> dash.Dash`, `server` |
| `leonardo/web/layout.py` | `build_layout(config)` |
| `leonardo/web/callbacks.py` | `register_callbacks(app, config)`, `mesh_figure` |
| `leonardo/web/assets/` | `favicon.ico`, `sample02.jpg` |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | container |
| `.github/workflows/ci.yml` | lint, test, multi-arch build to GHCR |
| `tests/` | one file per module |

---

### Task 1: Scaffold package and remove dead files

**Files:**
- Create: `pyproject.toml`, `leonardo/__init__.py`, `leonardo/engine/__init__.py`, `leonardo/web/__init__.py`, `tests/__init__.py`, `tests/conftest.py`
- Move: `src/assets/favicon.ico` -> `leonardo/web/assets/favicon.ico`, `imgs/sample02.jpg` -> copy to `leonardo/web/assets/sample02.jpg`
- Delete: `src/`, `app.py`, `Procfile`, `environment.yml`, `requirements.txt`, `.github/workflows/main_leonardoengine.yml`
- Modify: `.gitignore` (add `.venv/`, `output/`, `*.3mf`)

**Interfaces:**
- Produces: importable `leonardo` package, `pytest` runs, `ruff check .` runs.

- [ ] **Step 1: Write `pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=69"]
build-backend = "setuptools.build_meta"

[project]
name = "leonardo"
version = "1.0.0"
description = "Generative 3D design engine producing print-ready STL/3MF meshes"
requires-python = ">=3.11"
license = {text = "GPL-3.0-only"}
dependencies = [
  "numpy>=1.26,<3",
  "scipy>=1.11",
  "trimesh[easy]>=4.4",
  "pyyaml>=6",
  "dash>=3.0",
  "dash-bootstrap-components>=2.0",
  "plotly>=5.20",
  "gunicorn>=22",
]

[project.optional-dependencies]
dev = ["pytest>=8", "ruff>=0.5"]

[project.scripts]
leonardo = "leonardo.cli:main"

[tool.setuptools.packages.find]
include = ["leonardo*"]

[tool.setuptools.package-data]
"leonardo.web" = ["assets/*"]

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py311"
```

- [ ] **Step 2: Create package skeleton, move assets, delete dead files**

```bash
mkdir -p leonardo/engine leonardo/web/assets tests
touch leonardo/__init__.py leonardo/engine/__init__.py leonardo/web/__init__.py tests/__init__.py
git mv src/assets/favicon.ico leonardo/web/assets/favicon.ico
cp imgs/sample02.jpg leonardo/web/assets/sample02.jpg
git rm -r -q src app.py Procfile environment.yml requirements.txt .github/workflows/main_leonardoengine.yml
printf '\n# venv / outputs\n.venv/\noutput/\n*.3mf\n' >> .gitignore
```

- [ ] **Step 3: `tests/conftest.py`**

```python
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def config_path() -> Path:
    return ROOT / "config.yml"
```

- [ ] **Step 4: Create venv, install, verify**

Run: `uv venv .venv --python 3.12 && uv pip install -p .venv/bin/python -e '.[dev]' && .venv/bin/pytest -q && .venv/bin/ruff check .`
Expected: `no tests ran`, ruff `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold leonardo package, drop Azure/conda artifacts"
```

---

### Task 2: Config loader

**Files:**
- Create: `leonardo/config.py`, `tests/test_config.py`
- Modify: `config.yml`

**Interfaces:**
- Produces:
  - `class ConfigError(ValueError)`
  - `@dataclass(frozen=True) ModelConfig(num_texture_types: int, parameters: dict[str, float | tuple[float, float]])`
  - `@dataclass(frozen=True) PrintConfig(target_height_mm: float, min_radius_mm: float)`
  - `@dataclass(frozen=True) Config(models: dict[str, ModelConfig], print: PrintConfig, app: dict)`
  - `load_config(path: str | Path) -> Config`

- [ ] **Step 1: Failing tests**

```python
# tests/test_config.py
import pytest

from leonardo.config import Config, ConfigError, load_config


def test_loads_repo_config(config_path):
    cfg = load_config(config_path)
    assert isinstance(cfg, Config)
    assert set(cfg.models) == {"csym", "rsym"}
    assert cfg.models["csym"].parameters["radius"] == (30.0, 50.0)
    assert cfg.models["csym"].parameters["num_points"] == 250
    assert cfg.print.target_height_mm == 100.0
    assert cfg.app["preview_points"] == 120


def test_range_must_be_min_max(tmp_path):
    p = tmp_path / "c.yml"
    p.write_text(
        "models:\n  csym:\n    num_texture_types: 4\n    parameters:\n      radius: [50, 30]\n"
        "print: {target_height_mm: 100, min_radius_mm: 1}\napp: {}\n"
    )
    with pytest.raises(ConfigError, match=r"models\.csym\.parameters\.radius"):
        load_config(p)


def test_missing_section(tmp_path):
    p = tmp_path / "c.yml"
    p.write_text("models: {}\napp: {}\n")
    with pytest.raises(ConfigError, match="print"):
        load_config(p)
```

- [ ] **Step 2: Run** `.venv/bin/pytest tests/test_config.py -q` — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/config.py`**

```python
"""Load and validate config.yml into frozen dataclasses."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


class ConfigError(ValueError):
    """Raised when config.yml is malformed. Message names the offending key path."""


@dataclass(frozen=True)
class ModelConfig:
    num_texture_types: int
    parameters: dict[str, float | tuple[float, float]]


@dataclass(frozen=True)
class PrintConfig:
    target_height_mm: float
    min_radius_mm: float


@dataclass(frozen=True)
class Config:
    models: dict[str, ModelConfig]
    print: PrintConfig
    app: dict[str, Any]


def _number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ConfigError(f"{path}: expected a number, got {value!r}")
    return float(value)


def _parameter(value: Any, path: str) -> float | tuple[float, float]:
    if isinstance(value, list):
        if len(value) != 2:
            raise ConfigError(f"{path}: expected [min, max]")
        lo, hi = _number(value[0], path), _number(value[1], path)
        if lo > hi:
            raise ConfigError(f"{path}: expected [min, max] with min <= max, got {value}")
        return (lo, hi)
    return _number(value, path)


def _model(raw: Any, path: str) -> ModelConfig:
    if not isinstance(raw, dict):
        raise ConfigError(f"{path}: expected a mapping")
    if "num_texture_types" not in raw or "parameters" not in raw:
        raise ConfigError(f"{path}: needs num_texture_types and parameters")
    params = raw["parameters"]
    if not isinstance(params, dict):
        raise ConfigError(f"{path}.parameters: expected a mapping")
    return ModelConfig(
        num_texture_types=int(_number(raw["num_texture_types"], f"{path}.num_texture_types")),
        parameters={k: _parameter(v, f"{path}.parameters.{k}") for k, v in params.items()},
    )


def load_config(path: str | Path) -> Config:
    with open(path, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    for key in ("models", "print", "app"):
        if key not in raw or not isinstance(raw[key], dict):
            raise ConfigError(f"{key}: section missing or not a mapping")
    models = {name: _model(m, f"models.{name}") for name, m in raw["models"].items()}
    pr = raw["print"]
    print_cfg = PrintConfig(
        target_height_mm=_number(pr.get("target_height_mm"), "print.target_height_mm"),
        min_radius_mm=_number(pr.get("min_radius_mm"), "print.min_radius_mm"),
    )
    return Config(models=models, print=print_cfg, app=dict(raw["app"]))
```

- [ ] **Step 4: Update `config.yml`**

```yaml
models:
  csym:
    num_texture_types: 4
    parameters:
      num_points: 250
      radius_offset: 0.7
      radius: [30, 50]
      height: [80, 100]
      phi_amplitude: [0, 0.3]
      phi_frequency: [0, 100]
      phi_duty_cycle: [0, 1]
      z_amplitude: [0, 0.1]
      z_frequency: [0, 10]
      z_duty_cycle: [0, 1]
      twist: [-2, 2]
      edginess: [0, 5]
      tilt_x: [-200, 200]
      tilt_y: [-200, 200]

  rsym:
    num_texture_types: 4
    parameters:
      num_points: 250
      r_ratio: [0.2, 0.9]
      x_scaler: [1, 3]
      y_scaler: [1, 3]
      z_scaler: [1, 4]
      phi_amplitude: [0, 1]
      phi_frequency: [0, 20]
      phi_duty_cycle: [0, 1]
      theta_amplitude: [0, 1]
      theta_frequency: [0, 20]
      theta_duty_cycle: [0, 1]
      e1_twist: [-2, 2]
      e2_twist: [-2, 2]
      e3_twist: [-2, 2]
      edginess: [0, 10]
      tilt_x: [-200, 200]
      tilt_y: [-200, 200]

print:
  target_height_mm: 100
  min_radius_mm: 1.0

app:
  host: 0.0.0.0
  port: 8000
  preview_points: 120
  figure:
    height: 800
    margin: {t: 0, b: 0, l: 0, r: 0}
    color: "#b1b1b1"
    lighting:
      ambient: 0.1
      diffuse: 1
      fresnel: 0.1
      specular: 0.2
      roughness: 0.1
      facenormalsepsilon: 0
    lightposition: {x: 500, y: 500, z: 500}
  linkedin: "https://www.linkedin.com/in/daniel-hauser-77259a159"
```

Note: `csym.edginess` range changed from `[-2, 5]` to `[0, 5]` (old range hit
`1/(1+e)` singularity at `e = -1`). `rsym.r_ratio` changed from `[0, 1]` to
`[0.2, 0.9]` (avoids zero-volume torus).

- [ ] **Step 5: Run** `.venv/bin/pytest tests/test_config.py -q` — expected: 3 passed.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: typed config loader with validation"`

---

### Task 3: Structured grid and index triangulation

**Files:**
- Create: `leonardo/engine/grid.py`, `tests/test_grid.py`

**Interfaces:**
- Produces:
  - `make_grid(nu: int, nv: int, u_range: tuple[float, float], v_range: tuple[float, float], wrap_u: bool, wrap_v: bool) -> tuple[np.ndarray, np.ndarray]` — flattened `u`, `v` arrays of length `nu*nv`, row-major (`index = i*nv + j`). A wrapping axis omits its endpoint.
  - `grid_faces(nu: int, nv: int, wrap_u: bool, wrap_v: bool) -> np.ndarray` — `(M, 3)` int64.
  - `cap_faces(nu: int, nv: int, start_center: int, end_center: int) -> np.ndarray` — fans closing `i = 0` ring to `start_center` and `i = nu-1` ring to `end_center`, winding consistent with `grid_faces(wrap_u=False, wrap_v=True)`.

- [ ] **Step 1: Failing tests**

```python
# tests/test_grid.py
import numpy as np
import trimesh

from leonardo.engine.grid import cap_faces, grid_faces, make_grid


def test_make_grid_shapes_and_wrap():
    u, v = make_grid(4, 6, (0.0, 1.0), (0.0, 2 * np.pi), wrap_u=False, wrap_v=True)
    assert u.shape == v.shape == (24,)
    assert u[0] == 0.0 and u[-1] == 1.0
    assert v.max() < 2 * np.pi  # wrapped axis omits endpoint
    assert u[7] == u[6] and v[7] != v[6]  # row-major: index = i*nv + j


def test_grid_faces_counts():
    assert grid_faces(4, 6, False, False).shape == (2 * 3 * 5, 3)
    assert grid_faces(4, 6, False, True).shape == (2 * 3 * 6, 3)
    assert grid_faces(4, 6, True, True).shape == (2 * 4 * 6, 3)


def test_torus_topology_is_closed():
    nu, nv = 12, 16
    u, v = make_grid(nu, nv, (0, 2 * np.pi), (0, 2 * np.pi), True, True)
    x = (2 + np.cos(u)) * np.cos(v)
    y = (2 + np.cos(u)) * np.sin(v)
    z = np.sin(u)
    m = trimesh.Trimesh(np.c_[x, y, z], grid_faces(nu, nv, True, True), process=False)
    assert m.is_watertight and m.is_winding_consistent
    assert m.euler_number == 0


def test_capped_cylinder_is_closed():
    nu, nv = 10, 16
    z, phi = make_grid(nu, nv, (0.0, 5.0), (0.0, 2 * np.pi), False, True)
    verts = np.c_[np.cos(phi), np.sin(phi), z]
    verts = np.vstack([verts, [[0, 0, 0.0]], [[0, 0, 5.0]]])
    n = nu * nv
    faces = np.vstack([grid_faces(nu, nv, False, True), cap_faces(nu, nv, n, n + 1)])
    m = trimesh.Trimesh(verts, faces, process=False)
    assert m.is_watertight and m.is_winding_consistent
    assert m.euler_number == 2
    assert abs(abs(m.volume) - np.pi * 5) < 0.2
```

- [ ] **Step 2: Run** `.venv/bin/pytest tests/test_grid.py -q` — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/engine/grid.py`**

```python
"""Structured parametric grid and index-based triangulation.

Vertices are row-major: index = i * nv + j, where i runs along the first
parameter (u) and j along the second (v). A wrapping axis omits its endpoint so
the seam is closed by index modulo instead of duplicated vertices.
"""

from __future__ import annotations

import numpy as np


def make_grid(
    nu: int,
    nv: int,
    u_range: tuple[float, float],
    v_range: tuple[float, float],
    wrap_u: bool,
    wrap_v: bool,
) -> tuple[np.ndarray, np.ndarray]:
    u = np.linspace(u_range[0], u_range[1], nu, endpoint=not wrap_u)
    v = np.linspace(v_range[0], v_range[1], nv, endpoint=not wrap_v)
    uu, vv = np.meshgrid(u, v, indexing="ij")
    return uu.ravel(), vv.ravel()


def grid_faces(nu: int, nv: int, wrap_u: bool, wrap_v: bool) -> np.ndarray:
    ni = nu if wrap_u else nu - 1
    nj = nv if wrap_v else nv - 1
    i = np.arange(ni)[:, None]
    j = np.arange(nj)[None, :]
    i1 = (i + 1) % nu
    j1 = (j + 1) % nv
    a = np.broadcast_to(i * nv + j, (ni, nj)).ravel()
    b = np.broadcast_to(i1 * nv + j, (ni, nj)).ravel()
    c = np.broadcast_to(i1 * nv + j1, (ni, nj)).ravel()
    d = np.broadcast_to(i * nv + j1, (ni, nj)).ravel()
    return np.vstack([np.column_stack([a, b, c]), np.column_stack([a, c, d])]).astype(np.int64)


def cap_faces(nu: int, nv: int, start_center: int, end_center: int) -> np.ndarray:
    """Fan-close both open ends of a grid built with wrap_u=False, wrap_v=True."""
    j = np.arange(nv)
    j1 = (j + 1) % nv
    start_ring = j  # i = 0
    end_ring = (nu - 1) * nv + j
    end_ring1 = (nu - 1) * nv + j1
    start = np.column_stack([np.full(nv, start_center), start_ring, j1])
    end = np.column_stack([np.full(nv, end_center), end_ring1, end_ring])
    return np.vstack([start, end]).astype(np.int64)
```

- [ ] **Step 4: Run** `.venv/bin/pytest tests/test_grid.py -q` — expected: 4 passed.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: structured grid with wrap and fan caps"`

---

### Task 4: Spline modulator and textures

**Files:**
- Create: `leonardo/engine/spline.py`, `leonardo/engine/texture.py`, `tests/test_spline.py`, `tests/test_texture.py`

**Interfaces:**
- Produces:
  - `random_spline(t: np.ndarray, rng: np.random.Generator, degree_max: int = 5, knots_max: int = 7) -> np.ndarray` — same shape as `t`, values roughly in `[-1, 1]`.
  - `normalize01(a: np.ndarray) -> np.ndarray` — min-max to `[0, 1]`; constant input returns zeros.
  - `texture(t: np.ndarray, kind: int, amplitude: float, frequency: float, duty_cycle: float, rng: np.random.Generator) -> np.ndarray` — `1 + amplitude * wave(t)`; `kind` 0 sine, 1 sawtooth, 2 square, 3 gausspulse.

- [ ] **Step 1: Failing tests**

```python
# tests/test_spline.py
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
    assert not np.allclose(random_spline(t, np.random.default_rng(1)), random_spline(t, np.random.default_rng(2)))


def test_constant_input_is_finite():
    t = np.zeros(10)
    assert np.all(np.isfinite(random_spline(t, np.random.default_rng(0))))


def test_normalize01():
    np.testing.assert_allclose(normalize01(np.array([2.0, 4.0, 6.0])), [0, 0.5, 1])
    np.testing.assert_array_equal(normalize01(np.ones(3)), np.zeros(3))
```

```python
# tests/test_texture.py
import numpy as np
import pytest

from leonardo.engine.texture import texture


@pytest.mark.parametrize("kind", [0, 1, 2, 3])
def test_texture_bounds(kind):
    t = np.linspace(0, 2 * np.pi, 500)
    out = texture(t, kind, amplitude=0.2, frequency=3.0, duty_cycle=0.5, rng=np.random.default_rng(0))
    assert out.shape == t.shape
    assert np.all(out >= 0.8 - 1e-9) and np.all(out <= 1.2 + 1e-9)


def test_zero_amplitude_is_flat():
    t = np.linspace(0, 1, 50)
    np.testing.assert_array_equal(texture(t, 1, 0.0, 5.0, 0.3, np.random.default_rng(0)), np.ones(50))
```

- [ ] **Step 2: Run** both files — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/engine/spline.py`**

```python
"""Random B-spline modulators (replaces sklearn SplineTransformer)."""

from __future__ import annotations

import numpy as np
from scipy.interpolate import BSpline


def random_spline(
    t: np.ndarray, rng: np.random.Generator, degree_max: int = 5, knots_max: int = 7
) -> np.ndarray:
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
    lo, hi = float(a.min()), float(a.max())
    if hi <= lo:
        return np.zeros_like(a, dtype=float)
    return (a - lo) / (hi - lo)
```

- [ ] **Step 4: Implement `leonardo/engine/texture.py`**

```python
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
```

- [ ] **Step 5: Run** `.venv/bin/pytest tests/test_spline.py tests/test_texture.py -q` — expected: 9 passed.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: scipy spline modulator and textures"`

---

### Task 5: Pure geometric transforms

**Files:**
- Create: `leonardo/engine/transforms.py`, `tests/test_transforms.py`

**Interfaces:**
- Produces (all return new arrays; inputs untouched):
  - `twist(a, b, along, turns, rng) -> tuple[np.ndarray, np.ndarray]` — rotate `(a, b)` by angle `2π·turns·normalize01(along)`, optionally spline-fuzzed; 50% chance of no rotation (as original).
  - `tilt(x, y, z, tilt_x, tilt_y, rng) -> tuple[np.ndarray, np.ndarray]` — `x + tilt_x·spline(z)`, `y + tilt_y·spline(z)`.
  - `lame(r, angle, edginess) -> tuple[np.ndarray, np.ndarray]` — superellipse x,y from radius and angle.
  - `fit_to_print(vertices, target_height) -> np.ndarray` — uniform scale so z-extent == target, z-min at 0, xy centred.

- [ ] **Step 1: Failing tests**

```python
# tests/test_transforms.py
import numpy as np

from leonardo.engine.transforms import fit_to_print, lame, tilt, twist


def test_fit_to_print():
    v = np.array([[1, 2, 3], [3, 6, 7], [2, 4, 5.0]])
    out = fit_to_print(v, 100.0)
    assert np.isclose(out[:, 2].max() - out[:, 2].min(), 100.0)
    assert np.isclose(out[:, 2].min(), 0.0)
    assert np.isclose((out[:, 0].max() + out[:, 0].min()) / 2, 0.0)
    assert np.isclose((out[:, 1].max() + out[:, 1].min()) / 2, 0.0)
    assert v[0, 0] == 1  # input untouched


def test_lame_zero_edginess_is_circle():
    ang = np.linspace(0, 2 * np.pi, 50, endpoint=False)
    x, y = lame(np.full(50, 2.0), ang, 0.0)
    np.testing.assert_allclose(x, 2 * np.cos(ang), atol=1e-12)
    np.testing.assert_allclose(y, 2 * np.sin(ang), atol=1e-12)


def test_twist_preserves_radius_and_inputs():
    rng = np.random.default_rng(3)
    a = np.linspace(1, 2, 20)
    b = np.zeros(20)
    z = np.linspace(0, 1, 20)
    a0 = a.copy()
    a2, b2 = twist(a, b, z, 1.5, rng)
    np.testing.assert_allclose(np.hypot(a2, b2), np.hypot(a, b))
    np.testing.assert_array_equal(a, a0)


def test_tilt_shifts_by_function_of_z():
    rng = np.random.default_rng(3)
    x = np.zeros(30)
    y = np.zeros(30)
    z = np.repeat(np.linspace(0, 1, 10), 3)
    x2, y2 = tilt(x, y, z, 5.0, 0.0, rng)
    np.testing.assert_array_equal(y2, y)
    # same z -> same shift
    assert np.allclose(x2[0:3], x2[0])
    assert not np.allclose(x2, 0)
```

- [ ] **Step 2: Run** — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/engine/transforms.py`**

```python
"""Pure geometric transforms. Every function returns new arrays."""

from __future__ import annotations

import numpy as np

from leonardo.engine.spline import normalize01, random_spline


def twist(
    a: np.ndarray, b: np.ndarray, along: np.ndarray, turns: float, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
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
    return x + tilt_x * random_spline(z, rng), y + tilt_y * random_spline(z, rng)


def lame(r: np.ndarray, angle: np.ndarray, edginess: float) -> tuple[np.ndarray, np.ndarray]:
    p = 1.0 / (1.0 + edginess)
    c, s = np.cos(angle), np.sin(angle)
    return r * np.sign(c) * np.abs(c) ** p, r * np.sign(s) * np.abs(s) ** p


def fit_to_print(vertices: np.ndarray, target_height: float) -> np.ndarray:
    v = np.asarray(vertices, dtype=float)
    lo, hi = v.min(axis=0), v.max(axis=0)
    height = hi[2] - lo[2]
    if height <= 0:
        raise ValueError("degenerate design: zero height")
    scale = target_height / height
    centre = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    return (v - centre) * scale
```

- [ ] **Step 4: Run** — expected: 4 passed.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: pure transforms with fit-to-print"`

---

### Task 6: Parameters, models, mesh assembly, export

**Files:**
- Create: `leonardo/engine/params.py`, `leonardo/engine/models.py`, `leonardo/engine/mesh.py`, `tests/test_models.py`, `tests/test_export.py`
- Modify: `leonardo/engine/__init__.py`

**Interfaces:**
- Consumes: Task 2 `Config`, Task 3 grid, Task 4 spline/texture, Task 5 transforms.
- Produces:
  - `generate_parameters(config: Config, model: str, rng) -> dict[str, float | int]`
  - `MODELS: dict[str, Callable[[dict, PrintConfig, np.random.Generator], tuple[np.ndarray, np.ndarray]]]` — returns `(vertices (N,3), faces (M,3))` in raw units.
  - `@dataclass(frozen=True) Design(seed: int, model: str, parameters: dict, vertices: np.ndarray, faces: np.ndarray)` with `to_trimesh() -> trimesh.Trimesh`, `stem` property `f"{seed}_{model}"`.
  - `class MeshError(RuntimeError)` with `.seed`, `.model`.
  - `generate(config: Config, seed: int, model: str = "random", num_points: int | None = None) -> Design`
  - `export(design: Design, out_dir: Path, formats: Iterable[str] = ("stl", "3mf")) -> list[Path]`
  - `export_bytes(design: Design, fmt: str) -> bytes`
  - `pick_model(rng) -> str`

- [ ] **Step 1: Failing tests**

```python
# tests/test_models.py
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
    z = d.vertices[:, 2]
    assert np.isclose(z.max() - z.min(), cfg.print.target_height_mm, atol=1e-6)
    assert np.isclose(z.min(), 0.0, atol=1e-6)


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
    assert {k: v for k, v in a.parameters.items() if k != "num_points"} == {
        k: v for k, v in b.parameters.items() if k != "num_points"
    }


def test_mesh_error_type():
    err = MeshError(3, "csym", "not watertight")
    assert err.seed == 3 and err.model == "csym" and "watertight" in str(err)
```

```python
# tests/test_export.py
import trimesh

from leonardo.config import load_config
from leonardo.engine import export, export_bytes, generate


def test_export_writes_both_formats(tmp_path, config_path):
    d = generate(load_config(config_path), 42, "rsym", num_points=40)
    paths = export(d, tmp_path)
    names = sorted(p.name for p in paths)
    assert names == ["42_rsym.3mf", "42_rsym.stl"]
    for p in paths:
        m = trimesh.load(p, force="mesh")
        assert m.is_watertight
        assert abs(m.volume - d.to_trimesh().volume) / d.to_trimesh().volume < 1e-3


def test_export_bytes_3mf_is_zip(config_path):
    d = generate(load_config(config_path), 1, "csym", num_points=30)
    data = export_bytes(d, "3mf")
    assert data[:2] == b"PK"
```

- [ ] **Step 2: Run** — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/engine/params.py`**

```python
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
```

- [ ] **Step 4: Implement `leonardo/engine/models.py`**

```python
"""Parametric base models. Each returns (vertices (N,3), faces (M,3)) in raw units."""

from __future__ import annotations

from collections.abc import Callable

import numpy as np

from leonardo.config import PrintConfig
from leonardo.engine.grid import cap_faces, grid_faces, make_grid
from leonardo.engine.spline import normalize01, random_spline
from leonardo.engine.texture import texture
from leonardo.engine.transforms import lame, tilt, twist

ModelFn = Callable[[dict, PrintConfig, np.random.Generator], tuple[np.ndarray, np.ndarray]]


def design_csym(p: dict, pc: PrintConfig, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    n = int(p["num_points"])
    height, radius = p["height"], p["radius"]
    z, phi = make_grid(n, n, (0.0, height), (0.0, 2 * np.pi), wrap_u=False, wrap_v=True)

    # Radius profile along z: between radius_offset*R and R.
    profile = normalize01(random_spline(z, rng))
    r = radius * (p["radius_offset"] + (1.0 - p["radius_offset"]) * profile)
    r = r * texture(phi, p["phi_texture_type"], p["phi_amplitude"], p["phi_frequency"], p["phi_duty_cycle"], rng)
    r = r * texture(z / height * 2 * np.pi, p["z_texture_type"], p["z_amplitude"], p["z_frequency"], p["z_duty_cycle"], rng)
    r = np.maximum(r, pc.min_radius_mm)

    x, y = lame(r, phi, p["edginess"])

    # Cap centres share the transform pipeline so caps stay attached.
    x = np.append(x, [0.0, 0.0])
    y = np.append(y, [0.0, 0.0])
    z = np.append(z, [0.0, height])

    x, y = twist(x, y, z, p["twist"], rng)
    x, y = tilt(x, y, z, p["tilt_x"] / 100.0 * radius / 10.0, p["tilt_y"] / 100.0 * radius / 10.0, rng)

    nverts = n * n
    faces = np.vstack([grid_faces(n, n, False, True), cap_faces(n, n, nverts, nverts + 1)])
    return np.column_stack([x, y, z]), faces


def _angular_textures(theta: np.ndarray, phi: np.ndarray, p: dict, rng: np.random.Generator) -> dict:
    angles = {"theta": theta, "phi": phi}
    out = {}
    for axis in ("x", "y", "z"):
        label = "theta" if rng.integers(2) == 0 else "phi"
        t = texture(
            angles[label], p[f"{label}_texture_type"], p[f"{label}_amplitude"],
            p[f"{label}_frequency"], p[f"{label}_duty_cycle"], rng,
        )
        out[axis] = t * p[f"{axis}_scaler"]
    return out


def design_rsym(p: dict, pc: PrintConfig, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    n = int(p["num_points"])
    torus = bool(rng.integers(2))
    if torus:
        theta, phi = make_grid(n, n, (0.0, 2 * np.pi), (0.0, 2 * np.pi), True, True)
        rr = p["r_ratio"]
        x = (1 + rr * np.cos(theta)) * np.cos(phi)
        y = (1 + rr * np.cos(theta)) * np.sin(phi)
        z = rr * np.sin(theta)
        faces = grid_faces(n, n, True, True)
    else:
        # Interior theta rings only; poles appended as fan centres.
        theta_all = np.linspace(0.0, np.pi, n + 2)
        theta, phi = make_grid(n, n, (theta_all[1], theta_all[-2]), (0.0, 2 * np.pi), False, True)
        theta = np.append(theta, [0.0, np.pi])
        phi = np.append(phi, [0.0, 0.0])
        x = np.cos(phi) * np.sin(theta)
        y = np.sin(phi) * np.sin(theta)
        z = np.cos(theta)
        faces = np.vstack([grid_faces(n, n, False, True), cap_faces(n, n, n * n, n * n + 1)])

    tex = _angular_textures(theta, phi, p, rng)
    x, y, z = x * tex["x"], y * tex["y"], z * tex["z"]

    x, y = twist(x, y, z, p["e1_twist"], rng)
    x, z = twist(x, z, y, p["e2_twist"], rng)
    y, z = twist(y, z, x, p["e3_twist"], rng)
    return np.column_stack([x, y, z]), faces


MODELS: dict[str, ModelFn] = {"csym": design_csym, "rsym": design_rsym}
```

- [ ] **Step 5: Implement `leonardo/engine/mesh.py`**

```python
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
    vertices: np.ndarray
    faces: np.ndarray

    @property
    def stem(self) -> str:
        return f"{self.seed}_{self.model}"

    def to_trimesh(self) -> trimesh.Trimesh:
        return trimesh.Trimesh(self.vertices, self.faces, process=False)


def pick_model(rng: np.random.Generator) -> str:
    names = sorted(MODELS)
    return names[int(rng.integers(len(names)))]


def generate(config: Config, seed: int, model: str = "random", num_points: int | None = None) -> Design:
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
    vertices = fit_to_print(vertices, config.print.target_height_mm)
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    if not mesh.is_watertight or not mesh.is_winding_consistent:
        raise MeshError(seed, model, "not watertight")
    if mesh.volume < 0:
        faces = faces[:, ::-1]
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
```

- [ ] **Step 6: `leonardo/engine/__init__.py`**

```python
from leonardo.engine.mesh import FORMATS, Design, MeshError, export, export_bytes, generate, pick_model
from leonardo.engine.models import MODELS

__all__ = ["FORMATS", "Design", "MeshError", "MODELS", "export", "export_bytes", "generate", "pick_model"]
```

- [ ] **Step 7: Run** `.venv/bin/pytest tests/test_models.py tests/test_export.py -q` — expected: all pass. If any seed fails watertight, fix the model (not the test).

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat: watertight csym/rsym models with seeded generation and STL/3MF export"`

---

### Task 7: CLI

**Files:**
- Create: `leonardo/cli.py`, `tests/test_cli.py`

**Interfaces:**
- Consumes: `generate`, `export`, `MeshError`, `load_config`.
- Produces: `main(argv: list[str] | None = None) -> int`; console script `leonardo`.
- `serve` imports `leonardo.web.app.create_app` (Task 8). Until Task 8 exists, `serve` raises `SystemExit("web app not installed")` — replaced in Task 8.

- [ ] **Step 1: Failing tests**

```python
# tests/test_cli.py
from leonardo.cli import main


def test_generate_count_writes_files(tmp_path, config_path):
    rc = main(["generate", "--seed", "10", "--count", "3", "--out", str(tmp_path),
               "--config", str(config_path), "--points", "30"])
    assert rc == 0
    files = sorted(p.name for p in tmp_path.iterdir())
    assert len(files) == 6
    assert all(f.split("_")[0] in {"10", "11", "12"} for f in files)


def test_generate_single_format(tmp_path, config_path):
    rc = main(["generate", "--seed", "1", "--out", str(tmp_path), "--config", str(config_path),
               "--format", "stl", "--points", "30", "--model", "csym"])
    assert rc == 0
    assert [p.name for p in tmp_path.iterdir()] == ["1_csym.stl"]


def test_bad_model_exits_nonzero(tmp_path, config_path):
    rc = main(["generate", "--model", "nope", "--out", str(tmp_path), "--config", str(config_path)])
    assert rc != 0
```

- [ ] **Step 2: Run** — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/cli.py`**

```python
"""Command line entry point: `leonardo generate` and `leonardo serve`."""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

import numpy as np

from leonardo.config import ConfigError, load_config
from leonardo.engine import FORMATS, MODELS, MeshError, export, generate

log = logging.getLogger("leonardo")


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="leonardo", description="Leonardo generative design engine")
    p.add_argument("--config", default=os.environ.get("LEONARDO_CONFIG", "config.yml"))
    sub = p.add_subparsers(dest="command", required=True)

    g = sub.add_parser("generate", help="generate designs and write STL/3MF files")
    g.add_argument("--seed", type=int, default=None, help="first seed; random when omitted")
    g.add_argument("--count", type=int, default=1)
    g.add_argument("--model", default="random", choices=["random", *sorted(MODELS)])
    g.add_argument("--out", default=os.environ.get("LEONARDO_OUT", "output"))
    g.add_argument("--format", default="stl,3mf", help="comma list of: " + ",".join(FORMATS))
    g.add_argument("--points", type=int, default=None, help="override num_points")

    s = sub.add_parser("serve", help="run the web UI")
    s.add_argument("--host", default=None)
    s.add_argument("--port", type=int, default=None)
    return p


def _generate(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    formats = [f.strip() for f in args.format.split(",") if f.strip()]
    for f in formats:
        if f not in FORMATS:
            log.error("unknown format %s", f)
            return 2
    first = args.seed if args.seed is not None else int(np.random.default_rng().integers(2**31))
    failed = 0
    for seed in range(first, first + args.count):
        try:
            design = generate(config, seed, args.model, num_points=args.points)
        except MeshError as err:
            log.warning("skipped: %s", err)
            failed += 1
            continue
        for path in export(design, Path(args.out), formats):
            print(f"{design.seed}\t{design.model}\t{path}")
    return 1 if failed else 0


def _serve(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    from leonardo.web.app import create_app

    app = create_app(config)
    app.run(host=args.host or config.app.get("host", "0.0.0.0"),
            port=args.port or int(config.app.get("port", 8000)))
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        args = _parser().parse_args(argv)
    except SystemExit as e:
        return int(e.code or 0)
    try:
        return _generate(args) if args.command == "generate" else _serve(args)
    except ConfigError as err:
        log.error("config: %s", err)
        return 2


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run** `.venv/bin/pytest tests/test_cli.py -q` — expected: 3 passed.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: leonardo CLI with generate and serve"`

---

### Task 8: Web UI

**Files:**
- Create: `leonardo/web/app.py`, `leonardo/web/layout.py`, `leonardo/web/callbacks.py`, `tests/test_web.py`

**Interfaces:**
- Consumes: `generate`, `export_bytes`, `MeshError`, `Config`.
- Produces:
  - `create_app(config: Config) -> dash.Dash`
  - module-level `server` in `leonardo.web.app` (gunicorn target `leonardo.web.app:server`), built from `LEONARDO_CONFIG` env or `config.yml`.
  - `mesh_figure(design: Design, config: Config) -> dict`
  - `register_callbacks(app, config)`; callbacks importable as `on_design(n_clicks, config)` and `on_download(n_clicks, store, config)` for tests.

- [ ] **Step 1: Failing tests**

```python
# tests/test_web.py
import pytest
from dash.exceptions import PreventUpdate

from leonardo.config import load_config
from leonardo.web.app import create_app
from leonardo.web.callbacks import on_design, on_download


@pytest.fixture(scope="module")
def cfg(config_path):
    c = load_config(config_path)
    return type(c)(models=c.models, print=c.print, app={**c.app, "preview_points": 30})


def test_app_builds(cfg):
    app = create_app(cfg)
    assert app.title == "Leonardo Engine"


def test_design_returns_figure_and_store(cfg):
    fig, store, label = on_design(1, cfg)
    assert fig["data"][0]["type"] == "mesh3d"
    assert set(store) == {"seed", "model"}
    assert str(store["seed"]) in label


def test_design_prevent_update_on_zero(cfg):
    with pytest.raises(PreventUpdate):
        on_design(0, cfg)


def test_download_regenerates_from_store(cfg):
    _, store, _ = on_design(1, cfg)
    out = on_download(1, store, cfg)
    assert out["filename"] == f"{store['seed']}_{store['model']}.3mf"
    assert out["base64"] is True


def test_download_prevent_update_without_store(cfg):
    with pytest.raises(PreventUpdate):
        on_download(1, None, cfg)
```

- [ ] **Step 2: Run** — expected: ImportError.

- [ ] **Step 3: Implement `leonardo/web/layout.py`**

```python
"""Dash layout: sidebar card with actions, 3D preview, author card."""

from __future__ import annotations

import dash_bootstrap_components as dbc
from dash import dcc, html

from leonardo.config import Config


def _hidden_axis() -> dict:
    return dict(showbackground=False, title="", showticklabels=False, showgrid=False,
                zeroline=False, showspikes=False)


def empty_figure(config: Config) -> dict:
    fig = config.app["figure"]
    return {
        "data": [{"type": "mesh3d", "x": [], "y": [], "z": [], "i": [], "j": [], "k": []}],
        "layout": {"height": fig["height"], "margin": fig["margin"],
                   "scene": {"xaxis": _hidden_axis(), "yaxis": _hidden_axis(), "zaxis": _hidden_axis()}},
    }


def build_layout(config: Config) -> html.Div:
    card = dbc.Card(dbc.CardBody([
        dbc.CardImg(src="/assets/sample02.jpg", top=True),
        html.H4("Generative Design Engine Leonardo", className="card-title mt-3"),
        html.P("Create unique, print-ready 3D designs.", className="card-text"),
        html.Div([
            dbc.Button("Design", id="generate", n_clicks=0, outline=True, color="dark"),
            dbc.Button("Download 3MF", id="download-button", n_clicks=0, outline=True, color="primary"),
        ], className="d-grid gap-2"),
        html.Small(id="seed-label", className="text-muted d-block mt-2"),
        dbc.Alert(id="error", color="danger", is_open=False, className="mt-2"),
    ]))
    author = dbc.Card(dbc.CardBody([
        html.H4("About", className="card-title"),
        html.P(["Physicist with a passion for leadership as well as tackling complex technical "
                "and cultural challenges. Lets connect @ ",
                html.A("LinkedIn", href=config.app["linkedin"], target="_blank")],
               className="card-text"),
    ]), className="mt-3")
    graph = dcc.Loading(dcc.Graph(id="graph", figure=empty_figure(config),
                                  config={"displayModeBar": False}),
                        type="dot", color=config.app["figure"]["color"])
    return dbc.Container([
        dcc.Store(id="design-store"),
        dcc.Download(id="download"),
        dbc.Row([dbc.Col([card, author], md=4, className="py-3"), dbc.Col(graph, md=8)]),
    ], fluid=True)
```

- [ ] **Step 4: Implement `leonardo/web/callbacks.py`**

```python
"""Dash callbacks. Pure functions `on_design` / `on_download` are unit-testable."""

from __future__ import annotations

import base64

import numpy as np
from dash import Input, Output, State
from dash.exceptions import PreventUpdate

from leonardo.config import Config
from leonardo.engine import Design, MeshError, export_bytes, generate
from leonardo.web.layout import _hidden_axis

RETRIES = 3


def mesh_figure(design: Design, config: Config) -> dict:
    fig = config.app["figure"]
    v, f = design.vertices, design.faces
    color = fig["color"]
    return {
        "data": [{
            "type": "mesh3d",
            "x": v[:, 0], "y": v[:, 1], "z": v[:, 2],
            "i": f[:, 0], "j": f[:, 1], "k": f[:, 2],
            "intensity": v[:, 2], "colorscale": [[0, color], [1, color]], "showscale": False,
            "flatshading": True, "hoverinfo": "none",
            "lighting": fig["lighting"], "lightposition": fig["lightposition"],
        }],
        "layout": {"height": fig["height"], "margin": fig["margin"], "scene_aspectmode": "data",
                   "scene": {"xaxis": _hidden_axis(), "yaxis": _hidden_axis(), "zaxis": _hidden_axis(),
                             "aspectmode": "data"}},
    }


def on_design(n_clicks: int | None, config: Config) -> tuple[dict, dict, str]:
    if not n_clicks:
        raise PreventUpdate
    rng = np.random.default_rng()
    last: MeshError | None = None
    for _ in range(RETRIES):
        seed = int(rng.integers(2**31))
        try:
            design = generate(config, seed, "random", num_points=int(config.app["preview_points"]))
        except MeshError as err:
            last = err
            continue
        return (mesh_figure(design, config),
                {"seed": design.seed, "model": design.model},
                f"seed {design.seed} · model {design.model}")
    raise last  # type: ignore[misc]


def on_download(n_clicks: int | None, store: dict | None, config: Config) -> dict:
    if not n_clicks or not store:
        raise PreventUpdate
    design = generate(config, int(store["seed"]), store["model"])
    data = export_bytes(design, "3mf")
    return {"content": base64.b64encode(data).decode(), "filename": f"{design.stem}.3mf",
            "base64": True, "type": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"}


def register_callbacks(app, config: Config) -> None:
    @app.callback(
        Output("graph", "figure"), Output("design-store", "data"), Output("seed-label", "children"),
        Output("error", "children"), Output("error", "is_open"),
        Input("generate", "n_clicks"), prevent_initial_call=True,
    )
    def _design(n_clicks):
        try:
            fig, store, label = on_design(n_clicks, config)
        except MeshError as err:
            raise PreventUpdate from err if False else _error(str(err))
        return fig, store, label, "", False

    @app.callback(Output("download", "data"), Input("download-button", "n_clicks"),
                  State("design-store", "data"), prevent_initial_call=True)
    def _download(n_clicks, store):
        return on_download(n_clicks, store, config)


class _error(Exception):
    pass
```

Replace the `_design` body above with this exact version (the line with `if False` is a placeholder pattern and must not ship):

```python
    def _design(n_clicks):
        from dash import no_update

        try:
            fig, store, label = on_design(n_clicks, config)
        except MeshError as err:
            return no_update, no_update, no_update, str(err), True
        return fig, store, label, "", False
```

and delete `class _error`.

- [ ] **Step 5: Implement `leonardo/web/app.py`**

```python
"""Dash app factory and gunicorn entry point."""

from __future__ import annotations

import os

import dash
import dash_bootstrap_components as dbc

from leonardo.config import Config, load_config
from leonardo.web.callbacks import register_callbacks
from leonardo.web.layout import build_layout


def create_app(config: Config) -> dash.Dash:
    app = dash.Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP], title="Leonardo Engine")
    app.layout = build_layout(config)
    register_callbacks(app, config)
    return app


def _default_server():
    return create_app(load_config(os.environ.get("LEONARDO_CONFIG", "config.yml"))).server


server = _default_server() if os.environ.get("LEONARDO_SKIP_SERVER") is None else None
```

Set `LEONARDO_SKIP_SERVER=1` in `tests/conftest.py` via `os.environ.setdefault` at import time so importing `leonardo.web.app` in tests does not build the server from CWD.

- [ ] **Step 6: Run** `.venv/bin/pytest tests/test_web.py -q` — expected: 5 passed. Then `.venv/bin/leonardo serve --port 8050 &`, `curl -s localhost:8050 | head -c 200`, kill.

- [ ] **Step 7: Commit** `git add -A && git commit -m "feat: Dash UI with seeded designs and in-memory 3MF download"`

---

### Task 9: Docker, CI, README

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: `Dockerfile`**

```dockerfile
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    LEONARDO_CONFIG=/app/config.yml LEONARDO_OUT=/data

RUN useradd --create-home --uid 1000 leonardo && mkdir -p /data && chown leonardo /data
WORKDIR /app

COPY pyproject.toml README.md LICENSE ./
COPY leonardo ./leonardo
COPY config.yml ./
RUN pip install --only-binary=:all: --no-compile . && pip check

USER leonardo
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/').status==200 else 1)"

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8000", "--timeout", "120", "leonardo.web.app:server"]
```

- [ ] **Step 2: `.dockerignore`**

```
.git
.venv
.github
docs
imgs
output
tests
**/__pycache__
*.stl
*.3mf
```

- [ ] **Step 3: `docker-compose.yml`**

```yaml
services:
  leonardo:
    build: .
    image: ghcr.io/dugi42/leonardo:latest
    ports:
      - "8000:8000"
    volumes:
      - ./output:/data
    environment:
      LEONARDO_CONFIG: /app/config.yml
    restart: unless-stopped
```

- [ ] **Step 4: `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e '.[dev]'
      - run: ruff check .
      - run: pytest -q

  image:
    needs: test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/arm64,linux/amd64
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

- [ ] **Step 5: Build and smoke-test image locally**

Run:
```bash
docker buildx build --platform linux/arm64 -t leonardo:arm64 --load .
docker run --rm -v "$PWD/output:/data" leonardo:arm64 leonardo generate --count 2 --points 60
docker run --rm -d -p 8000:8000 --name leo leonardo:arm64 && sleep 15 && curl -sf localhost:8000 >/dev/null && echo OK; docker rm -f leo
```
Expected: 4 files in `output/`, `OK`.

- [ ] **Step 6: README** — replace Azure/conda sections with Docker-on-Pi, CLI, dev setup, Bambu Studio import steps, and note on watertight 3MF.

- [ ] **Step 7: Run full suite** `.venv/bin/pytest -q && .venv/bin/ruff check .` — expected: all pass.

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat: Docker image, multi-arch CI, README for Raspberry Pi"`
