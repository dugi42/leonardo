# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because a seed maps to a design through the geometry code, any change that
alters what a seed produces is a **major** release.

## [3.1.0] - 2026-10-15

### Changed (breaking)

Seeds and links from 3.0 produce different shapes. 3.0 links still open; they load as
cylinders with the old proportions.

- **Form language.** Every design starts from one of seven forms: cylinder, tumbler,
  vase, bottle, bowl, lantern or amphora.
  - **Proportion** runs from slender to squat.
  - **Rim** is flat, round or flared. On hollow and planter bodies a round rim is a
    real half-round lip.
  - **Foot** adds an optional pedestal.
- **Spectrum on the log radius.** The spectrum now describes the log of the radius on
  top of the form, and extreme detail is softly limited.
  - Deep flutes become ridges instead of flat star plateaus or thin fins.
  - Random designs favour symmetric flutes.

### Added

- **Spectrum editor.**
  - Tick labels.
  - A hover readout of k, m and strength.
  - While you hover a cell, the 3D model is tinted with what that frequency does.
  - Boost (×1.6) and Damp (×0.5) are stronger, and Boost now works on empty cells.
- **Filament.** 13 approximate PLA colours and three finishes (matte, basic, silk),
  shown in the viewport and the thumbnails. The colour is written into the 3MF as a
  base material.
- **Viewport.**
  - Turntable toggle.
  - Overhang chip and "View from below".
  - Loading state while the 3D view loads.
- **Export.** The buttons show when an export is running; a second click does not
  start a second export.
- **Explore.** Variation tiles are labelled Parent and Variation 1–8.

### Fixed

- The overhang and tint colours were never visible because the material did not
  update when vertex colours were switched on.
- Opening an Explore tile no longer resets your filament, body and printer settings.
- The "Built with Netlify" badge no longer covers controls.

## [3.0.0] - 2026-10-15

### Changed (breaking)

Leonardo is now a browser app written in TypeScript and deployed on Netlify. Seeds
from 2.x do not reproduce in 3.x.

- Shapes are Fourier spectra: `r(h, φ) = Σ (C cos mφ + S sin mφ) cos(πkh)`. The
  csym model is replaced by the spectrum vessel. The rsym ellipsoid/torus model is
  removed. Twist and superellipse corners remain as modifiers. Tilt is removed
  because it caused most of the unprintable overhangs.
- New workflow:
  - Explore grid with variations.
  - Spectrum heatmap editor with K × M truncation and boost/damp brushes.
  - Undo/redo, a share URL in the address bar, and IndexedDB history with
    favourites.
- Print setup:
  - Bambu printer presets with a bed view.
  - Solid, vase-mode, hollow and planter bodies.
  - Overhang heatmap, plus size, volume and PLA weight estimates.
- English and German interface.
- Removed: the Python package, the Dash UI, the CLI, the Docker image and the
  Raspberry Pi deployment.

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
