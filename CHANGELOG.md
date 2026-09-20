# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because a seed maps to a design through the geometry code, any change that
alters what a seed produces is a **major** release.

## [Unreleased]

### Changed

- Project tooling moved from pip to [uv](https://docs.astral.sh/uv/): dev
  dependencies live in `[dependency-groups]`, `uv.lock` pins the full tree, and
  the Dockerfile and CI install with `uv sync --locked`. Local setup is `uv sync`.

## [2.0.0] - 2026-09-19

### Changed (breaking)

Every design changes for a given seed. Seeds printed with 1.x are not
reproducible with 2.x.

- `texture.py`: gausspulse texture (kind 3) is now a pulse train repeating every
  period instead of a single spike at `t = 0` (#1).
- `texture.py`: new `wrap` flag rounds the frequency to an integer on wrapped
  angles so textures close without a seam (#2).
- `models.py` (`rsym`): one positive scale factor per vertex (theta texture times
  phi texture) replaces independent per-axis textures; the ellipsoid stays
  star-shaped and the torus tube radius is textured and capped below the ring
  radius, so the mesh no longer self-intersects (#3). The factor is clamped to a
  minimum of 0.1 (#4).
- `transforms.py` (`lame`): polar superellipse form; samples are spread evenly
  and the point stays on the ray at its angle (#5).
- `transforms.py` (`twist`): the fuzzy variant modulates the twist rate instead
  of replacing the angle, so `turns` is respected (#6).
- `config.yml`: `csym.phi_frequency` capped at 30 (was 100) to stay above the
  Nyquist limit of the grid (#7); `rsym.phi_amplitude` and
  `rsym.theta_amplitude` capped at 0.8 (was 1) (#4).

### Added

- Rewrite as an installable package with a `leonardo` CLI (`generate`, `serve`),
  a Dash web UI with in-memory 3MF download, typed config loader, and a
  watertight/volume check on every generated mesh.
- Docker image for Raspberry Pi 4/5 (`linux/arm64`) and x86-64, multi-arch CI
  publishing to `ghcr.io/dugi42/leonardo`.
- Regression tests for seam closure, gausspulse coverage, superellipse sampling,
  fuzzy twist magnitude and `rsym` volume validity.

## [1.0.0]

Original notebook-style generator: `csym` and `rsym` models, STL export, Azure
deployment scripts. No seeding.

[Unreleased]: https://github.com/dugi42/leonardo/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/dugi42/leonardo/compare/v.1.0.0...v2.0.0
[1.0.0]: https://github.com/dugi42/leonardo/releases/tag/v.1.0.0
