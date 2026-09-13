# Leonardo on Raspberry Pi with Docker, exporting Bambu-ready meshes

Date: 2026-09-13
Status: approved

## Goal

Rework the Leonardo generative design engine so that it:

1. Runs on a Raspberry Pi 4 / Pi 5 (64-bit OS, `linux/arm64`) inside Docker.
2. Produces watertight, millimetre-scaled meshes exported as `.3mf` and `.stl`
   that open cleanly in Bambu Studio and slice without mesh repair.
3. Offers both the existing Dash web UI and a headless CLI from one image.

Out of scope: slicing on the Pi, pushing files to the printer over LAN,
support for 32-bit Pi OS or Pi Zero.

## Findings from the code review that drive the design

- `mtri.Triangulation(a, b)` performs a Delaunay triangulation on the flattened
  parameter grid. Winding is random, the phi seam is not closed, and there are no
  end caps. The exported STL is open and non-manifold.
- The `(1 + 1/num_points)` overshoot in `generate_grid` tries to close the seam
  by overlapping the first and last ring. It produces overlapping faces, not a
  closed surface.
- `rsym` output is unitless (about 1 to 4 units); `csym` output is roughly in
  millimetres. There is no consistent print scale.
- No random seed is used, so designs are not reproducible.
- The download callback returns `None` when not clicked and Dash raises.
- A single `export.stl` in the working directory is shared between all users.
- Dependencies are pinned to 2021 versions on Python 3.9, which has no arm64
  wheels for current interpreters. scikit-learn and matplotlib are heavy and
  each used for one function.
- `src/__machine__.py`, `Procfile`, the Azure workflow, `environment.yml` and
  `requirements.txt` are dead or obsolete.

## Approach

Rewrite the engine core around a structured-grid index triangulation, keep the
Dash shell, add a CLI, and package everything in one multi-arch Docker image.

Rejected alternative: keep the Delaunay mesh and repair it with trimesh after
the fact. Repair is not guaranteed on the overlapped seam and it hides the root
cause.

## 1. Package layout

```
leonardo/
  pyproject.toml            # single dependency source
  config.yml                # parameter space + app + print settings
  Dockerfile                # python:3.12-slim-bookworm, arm64 + amd64
  docker-compose.yml        # port 8000, ./output:/data
  leonardo/
    __init__.py
    config.py               # load_config(path), dataclass validation, ConfigError
    engine/
      __init__.py
      grid.py               # structured grid, index triangulation, wrap, caps
      spline.py             # random B-spline modulator (scipy.interpolate.BSpline)
      texture.py            # sine / sawtooth / square / gausspulse textures
      transforms.py         # twist, tilt, edginess, fit_to_print (pure functions)
      models.py             # design_csym, design_rsym, MODELS registry
      params.py             # generate_parameters(config, model, rng)
      mesh.py               # Design dataclass, to_trimesh, check, export
    cli.py                  # `leonardo generate`, `leonardo serve`
    web/
      app.py                # Dash app factory + gunicorn `server`
      layout.py
      callbacks.py
      assets/favicon.ico
      assets/sample02.jpg
  tests/
  README.md
```

Removed: `src/`, `app.py`, `Procfile`, `environment.yml`, `requirements.txt`,
`.github/workflows/main_leonardoengine.yml`. `imgs/` keeps the README images.

Runtime dependencies: `numpy`, `scipy`, `numpy-stl`, `trimesh[easy]` (for 3MF),
`dash`, `dash-bootstrap-components`, `plotly`, `pyyaml`, `gunicorn`.
Dev dependencies: `pytest`, `ruff`.

## 2. Engine

### Data flow

```
seed
  -> rng = numpy.random.default_rng(seed)
  -> params = generate_parameters(config, model, rng)
  -> vertices (N x 3 float64, mm), faces (M x 3 int64) = MODELS[model](params, rng)
  -> Design(seed, model, params, vertices, faces)
  -> Design.to_trimesh(): assert watertight; flip faces if signed volume < 0
  -> export: <seed>_<model>.stl, <seed>_<model>.3mf
```

Every function that consumes randomness takes an explicit `rng:
numpy.random.Generator`. No module-level `np.random` calls. The same seed
always produces identical vertices.

Transforms are pure: they return new arrays and never mutate their inputs.

### Grid and triangulation (`grid.py`)

A grid has `nu` samples along the first parameter and `nv` along the second.
Vertices are stored row-major, index `i * nv + j`. Faces are built from indices:
quad `(i, j), (i+1, j), (i+1, j+1), (i, j+1)` becomes two counter-clockwise
triangles. An axis marked as wrapping uses `(i + 1) % nu`; the last sample is
therefore *not* duplicated and the seam is closed by construction. The
`(1 + 1/num_points)` overshoot is gone.

Closure rules:

- `csym`: phi wraps, z is open at both ends. A centre vertex is added at
  `z = 0` and at `z = height`, and a triangle fan closes each end. Watertight.
- `rsym` ellipsoid: phi wraps, theta runs from 0 to pi. The rings at theta = 0
  and theta = pi collapse to one vertex each and are closed with a fan.
  Watertight.
- `rsym` torus: both axes wrap. Watertight without caps.

### Modulators and textures

`spline.py` replaces `sklearn.preprocessing.SplineTransformer` with a random
B-spline basis built from `scipy.interpolate.BSpline`: random degree in
`[1, degree_max]`, random knot count in `[2, knots_max]`, random coefficients in
`[-1, 1]` drawn from `rng`. Output is a modulator array the same length as the
input.

`texture.py` keeps the four texture types (sine, sawtooth, square, gausspulse)
with the same parameters.

Negative or near-zero radii caused by large texture amplitudes are clamped to
`config.print.min_radius_mm` (default 1.0). Self-intersection is not prevented;
Bambu Studio slices self-intersecting but watertight meshes correctly.

### Fit to print (`transforms.fit_to_print`)

After all shape transforms, both models are uniformly scaled so that the
bounding-box height equals `config.print.target_height_mm` (default 100),
translated so `min(z) = 0`, and centred in x and y. This gives `rsym` real
units and makes both models the same nominal size.

### Registry

`models.MODELS: dict[str, Callable]` maps `"csym"` and `"rsym"` to their
functions. `globals()` lookup is removed.

## 3. CLI (`cli.py`)

Plain `argparse`. Installed as the `leonardo` console script.

```
leonardo generate [--seed N] [--model csym|rsym|random] [--count K]
                  [--out DIR] [--config PATH] [--format stl,3mf]
leonardo serve    [--host 0.0.0.0] [--port 8000] [--config PATH]
```

- `--seed` omitted: a random seed per design, printed with the output path.
- `--count K` with `--seed N`: seeds `N, N+1, ..., N+K-1`.
- `--model random` (default): model chosen from `rng`.
- `--out` default: `$LEONARDO_OUT` or `./output`.
- `--config` default: `$LEONARDO_CONFIG` or `./config.yml`.
- Exit code 0 when every design exported, 1 when any design was skipped.

## 4. Web UI (`leonardo/web`)

Same visual layout: card with image, "Design" and "Download" buttons, 3D
preview, author card. Changes:

- "Design" draws a random seed and model, generates, stores `{seed, model}` in
  a `dcc.Store`, and shows the seed below the figure. No file is written.
- "Download" regenerates the design from the stored seed and returns a `.3mf`
  through `dcc.send_bytes`. No shared file, no race between users.
- Both callbacks use `prevent_initial_call=True` and raise `PreventUpdate`
  when the store is empty.
- The preview mesh is generated with `config.app.preview_points` (default 120)
  so the browser stays responsive; export uses `config.models.<model>.parameters.num_points`
  (default 250). Because the seed is stored, both are derived from the same
  parameters.
- The card image and favicon are loaded from the package `assets/` directory
  via Dash's asset mechanism, not relative to the working directory.
- The "Last updated" line is removed.
- `server = app.server` is exposed for gunicorn.

## 5. Docker

`Dockerfile`:

- `FROM python:3.12-slim-bookworm`.
- `pip install --only-binary=:all: .` so no compiler is needed and the build
  fails loudly if a wheel is missing for the platform.
- Non-root user `leonardo`, workdir `/app`, output volume `/data`.
- `HEALTHCHECK` on `GET /`.
- Default command: `gunicorn -w 2 -b 0.0.0.0:8000 leonardo.web.app:server`.
- `ENTRYPOINT` not set, so `docker run <image> leonardo generate --out /data`
  works for headless use.

`docker-compose.yml`: service `leonardo`, `ports: 8000:8000`,
`volumes: ./output:/data`, `environment: LEONARDO_CONFIG=/app/config.yml`.

CI (`.github/workflows/ci.yml`): on push and pull request, run `ruff` and
`pytest` on `ubuntu-latest`; on push to `main`, `docker buildx` a
`linux/arm64,linux/amd64` image and push it to GHCR so the Pi pulls a prebuilt
image instead of building.

## 6. Configuration (`config.yml`)

Existing `models.*` sections are kept. Additions:

```yaml
print:
  target_height_mm: 100
  min_radius_mm: 1.0
app:
  host: 0.0.0.0
  port: 8000
  preview_points: 120
  figure: ...      # unchanged
  linkedin: ...    # unchanged
```

`config.py` loads YAML with `yaml.safe_load` into frozen dataclasses and raises
`ConfigError("models.csym.parameters.radius: expected [min, max]")`-style
messages on bad input.

## 7. Error handling

- `ConfigError` on invalid config, raised at startup with the offending key path.
- `MeshError(seed, model, reason)` when a generated mesh is not watertight or
  has zero volume. CLI logs it, skips the seed, continues, exits 1 at the end.
  Web retries with a new seed up to 3 times, then shows an alert in the UI.
- 3MF export goes through trimesh; missing optional dependencies fail at import
  time, not at the first download.

## 8. Testing

`pytest` in `tests/`:

- `test_grid.py`: face count equals expected; every edge is shared by exactly
  two faces; Euler characteristic is 2 for capped cylinder and ellipsoid, 0 for
  torus.
- `test_models.py`: for each model and 50 seeds, `trimesh.is_watertight`,
  `volume > 0`, bounding-box height equals `target_height_mm` within 1e-6.
- `test_determinism.py`: same seed twice gives identical vertices and faces.
- `test_export.py`: STL and 3MF round-trip through trimesh and stay watertight.
- `test_cli.py`: `generate --count 3 --format stl,3mf` writes six files;
  exit code 1 when a seed is skipped.
- `test_web.py`: callbacks raise `PreventUpdate` on empty input; download
  returns bytes for a stored seed.

## 9. README

Replaces the Azure instructions with:

- `docker compose up` on the Pi, open `http://<pi>:8000`.
- `docker compose run --rm leonardo leonardo generate --count 5 --out /data`.
- Local development: `pip install -e .[dev]`, `pytest`, `leonardo serve`.
- How to open the `.3mf` in Bambu Studio.
