# Leonardo 3: browser-only Fourier vessel designer on Netlify

Date: 2026-10-15
Status: approved

## Goal

Replace the Python/Dash app with a static TypeScript web app, deployed on
Netlify (`leonardo-design`), that lets makers design printable vessels whose
shape *is* a Fourier spectrum, refine them live, prepare them for a Bambu
printer, and download watertight STL/3MF files.

Audience: makers and power users (the author first). Desktop-first, usable on a
phone. UI in English and German.

Out of scope: accounts, server-side storage, ordering, slicing, spherical
harmonics, space-curve/epicycle mode, reconstruction from uploaded files.

## Decisions taken during brainstorming

| Topic | Decision |
|---|---|
| Runtime | Engine ported to TypeScript, runs fully in the browser |
| Python package, Dash UI, Docker, CLI | Removed |
| Models | `rsym` (ellipsoid/torus) dropped. `csym` replaced by the spectrum vessel |
| Core representation | Fourier spectrum `r(h, φ)` (see `fourier-reconstruction.md`) |
| Old features | Twist and superellipse edginess kept as modifiers. Wave textures become spectrum presets. Tilt dropped (overhangs, breaks wall offset) |
| Body types | Solid, vase (solid tuned for spiral vase mode + UI hint), hollow, planter |
| Print features | Printer bed presets + bed view, height control, overhang heatmap, stats |
| Workflow | Explore grid + variations, live sliders, spectrum editor, history + favourites, share URL |
| Stack | React 19, Vite, three.js via react-three-fiber, zustand, Vitest, Playwright |
| Look | Dark studio pro tool |
| Delivery | Branch `rework-ts`, PR, Netlify git-linked deploys (fallback: CLI deploy) |

## Approach

The spectrum is the only random source. A deterministic pipeline turns a
small serialisable `Design` into a mesh:

```
Design ─► coefficients (seed + recipe + edits, truncated to K×M)
       ─► radius field r(h, φ) on an Nh×Nφ grid      (separable inverse sum)
       ─► modifiers (twist, edginess)                (radius / angle remaps)
       ─► scale to print size (height, bed fit)
       ─► body builder (solid | vase | hollow | planter) ─► indexed mesh
       ─► validate (closed, oriented, positive volume) ─► preview / export
```

Every stage after coefficients maps a star-shaped cross-section to a
star-shaped cross-section, so the surface cannot fold and every body builder
can stitch rings by index.

Rejected: spectrum-only (superellipse corners are not band-limited and ring),
and keeping the old spline/texture generator with Fourier as a view (two
generators, no unified editing).

## 1. Repository layout

```
index.html, vite.config.ts, tsconfig.json, package.json, netlify.toml
src/
  engine/            pure TS, no React, no three.js
    prng.ts          sfc32 seeded PRNG, hashSeed
    spectrum.ts      Recipe -> coefficient grid, edits, truncation
    surface.ts       radius field from coefficients (separable)
    modifiers.ts     twist, edginess
    printers.ts      printer presets (bed size)
    fit.ts           print scaling
    body.ts          solid / vase / hollow / planter mesh builders
    mesh.ts          Mesh type, buildMesh(design, resolution)
    validate.ts      edge manifold check, signed volume
    stats.ts         dimensions, volume, area, overhang faces, grams
    export/stl.ts    binary STL
    export/threemf.ts 3MF (zip via fflate)
  design/
    schema.ts        Design type, defaults, clamp/normalise
    codec.ts         Design <-> URL string (versioned)
    mutate.ts        random design, variations
  worker/            export-resolution build + export in a Web Worker
  state/             zustand store (current design, mode, history)
  storage/           IndexedDB history (idb-keyval)
  i18n/              en.ts, de.ts, useT()
  ui/                React components
e2e/                 Playwright specs
```

## 2. Data model (shared contract)

```ts
type BodyKind = 'solid' | 'vase' | 'hollow' | 'planter';

interface Recipe {
  bulge: number;      // 0..1  amplitude of low-k profile terms
  flutes: number;     // 0..1  amplitude of m>0 terms
  roughness: number;  // 0..1  how slowly amplitudes decay with k and m
  symmetry: number;   // 0..12 integer; >0 keeps only m multiple of symmetry
  ribs: number;       // 0..1  preset: boost at m = ribFrequency, k = 0
  ribFrequency: number; // 3..32 integer
}

interface Design {
  v: 1;
  seed: number;                     // uint32
  spectrum: { K: number; M: number; recipe: Recipe; edits: Record<string, number> };
  modifiers: { twist: number; edginess: number }; // twist in turns -2..2, edginess 0..5
  body: { kind: BodyKind; wallMm: number; floorMm: number; holeMm: number };
  print: { printer: PrinterId; heightMm: number };
}
```

- `edits` keys are `"k,m"`, values are gains in `[0, 4]`. A gain scales the
  magnitude of `(C_km, S_km)` and keeps its phase. Gain 1 entries are removed.
- Coefficient grid maximum: `KMAX = 24` (k = 0..23), `MMAX = 32` (m = 0..31).
  `1 ≤ K ≤ KMAX`, `1 ≤ M ≤ MMAX`.
- `normaliseDesign` clamps every field into range; every entry point (URL,
  storage, UI) passes through it.

## 3. Maths

### Coefficients

`coefficients(seed, recipe)` returns `C[k][m], S[k][m]` (S[k][0] = 0):

- `C[0][0] = 1` (unit mean radius). All other terms random in `[-1, 1]`, scaled
  by the envelope `A(k, m)`, drawn from `sfc32(seed)` in fixed row-major order
  so results are identical across browsers.
- Envelope: `A(k, m) = base(k, m) · (1 + k)^-p · (1 + m)^-p` where
  `p = 2.5 − 1.7·roughness`, `base(k, 0) = 0.35·bulge` for k > 0, and
  `base(k, m) = 0.25·flutes` for m > 0.
- Symmetry `n > 0` zeroes every m > 0 not divisible by n.
- Ribs add `0.12·ribs` to `C[0][ribFrequency]` (clamped to M range).
- Edits multiply the pair by their gain; truncation zeroes `k ≥ K` and `m ≥ M`.

### Radius field

Height parameter `h ∈ [0, 1]`, angle `φ ∈ [0, 2π)`:

```
r(h, φ) = Σ_k Σ_m (C_km cos mφ + S_km sin mφ) · cos(π k h)
```

Evaluated separably: first `P_m(h) = Σ_k C_km cos(πkh)` and `Q_m(h)` for S,
then `r = Σ_m P_m cos mφ + Q_m sin mφ`. Cost O(Nh·K·M + Nh·Nφ·M).

The field is clamped to `r ≥ rMin = 0.15` (relative), which keeps the
section star-shaped and the walls printable.

### Modifiers

- Twist: `r'(h, φ) = r(h, φ − 2π·twist·h)`, implemented by evaluating the sum at
  the shifted angle (exact, no resampling).
- Edginess `e`: superellipse factor `s(φ) = (|cos φ|^q + |sin φ|^q)^(-1/q)`,
  `q = 2(1 + e)`, normalised so its mean over φ is 1; `r' = r · s(φ − twist
  angle)` so corners turn with the twist.

### Scaling to print

Radius unit is relative. Raw shape: height `H0 = 2.5` units for `h ∈ [0, 1]`.
Scale factor `σ = heightMm / H0`, then reduced so the xy bounding box fits the
printer bed minus a 10 mm margin; height is also capped by the printer's build
height. The resulting actual height is reported to the UI when the cap bites.

### Body builders

Grid: `Nh` rings (h = 0..1 inclusive), `Nφ` points per ring (no duplicate seam).
Preview resolution 96 × 128, export 256 × 384.

- **solid**: outer surface + bottom fan cap + top fan cap.
- **vase**: identical mesh to solid. UI shows "enable Spiral vase in your
  slicer". 3MF metadata carries `leonardo:hint = spiral-vase`.
- **hollow**: outer surface; inner surface at radius `r − wallMm/σ` (clamped
  so inner radius ≥ 0.5 mm), from `h_floor = floorMm/(σ·H0)` to top; rim strip
  joins outer and inner top rings; floor: bottom fan cap on outer bottom ring,
  inner bottom fan cap at `h_floor` (facing up into the cavity). Hollow
  requires `wallMm ≥ 0.8`, `floorMm ≥ 0.8`.
- **planter**: hollow, but bottom cap and inner floor cap become annuli around a
  hole of diameter `holeMm` joined by a hole tube.

All faces wind outward (normals point out of the material). Validation:

- every undirected edge belongs to exactly two faces and they traverse it in
  opposite directions (closed, oriented 2-manifold),
- no NaN coordinates,
- signed volume (divergence theorem) > 0.

### Stats

Bounding box (mm), volume (mm³), surface area, overhang area = faces whose
outward normal has `n_z < −cos(45°)` excluding the bottom face at z = 0,
estimated filament grams = `volume_shell_estimate × density` using
`walls 0.8 mm + 15 % infill` for solid/vase and full volume for hollow/planter,
PLA density 1.24 g/cm³. Labelled "estimate".

### Export

- STL: binary, little-endian, per-face normal.
- 3MF: zip with `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`
  (`unit="millimeter"`), vertices + triangles, built with fflate.
- File name: `leonardo-<seed>-<body>.stl|.3mf`.

## 4. Printers

Each preset is `{ id, name, bed: [x, y], height }` in mm. Third-party spec
listings disagree for the H2 series, so the H2D uses the smaller dual-nozzle
volume.

| id | name | bed x × y | height |
|---|---|---|---|
| a1mini | A1 mini | 180 × 180 | 180 |
| a1 | A1 | 256 × 256 | 256 |
| p1s | P1S / P2S | 256 × 256 | 256 |
| x1c | X1C / X1E | 256 × 256 | 256 |
| h2s | H2S | 340 × 320 | 340 |
| h2d | H2D (dual nozzle) | 300 × 320 | 325 |
| custom | Custom 250 | 250 × 250 | 250 |

## 5. Share URL and codec

`#d=<payload>` in the URL hash. Payload = base64url(JSON of the Design with
short keys). Decoding is tolerant: unknown version or invalid JSON ⇒ `null`
and the UI shows a toast and keeps the current design. `encode(decode(s))`
round-trips; `decode(encode(d))` equals `normaliseDesign(d)`.

## 6. Workflow and UI

Dark studio theme. Top bar: logo, mode switch **Explore / Refine / Print**,
design name (seed), Share, Export STL, Export 3MF, history button, EN/DE.

- **Explore**: 3×3 grid of designs. "Shuffle" draws 9 new random designs.
  Clicking a tile selects it; "Variations" replaces the other 8 with mutations
  of the selected one (temperature slider 0..1 controls mutation size:
  recipe jitter, K/M ±, twist/edginess jitter, new seed with probability
  `temperature`). "Refine" opens the selected design.
- **Refine**: centre 3D viewport (orbit controls). Right panel:
  - Spectrum heatmap (KMAX × MMAX cells, log magnitude). The kept K×M
    rectangle is highlighted; dragging its corner handle sets K and M. Clicking
    or dragging over cells in "boost" or "damp" brush mode multiplies gains by
    1.25 or 0.8 per stroke; "reset edits" clears them.
  - Recipe sliders: bulge, flutes, roughness, symmetry, ribs, rib frequency.
  - Modifiers: twist, edginess. New seed button.
- **Print**: printer select, height mm, body kind with wall, floor, hole
  inputs, overhang heatmap toggle, stats card, vase hint. Viewport shows the
  bed plate outline to scale.
- **History**: drawer listing saved designs (IndexedDB) with thumbnail, date,
  star toggle, delete. A design is saved when exported or shared or starred,
  and on "Save" in the top bar. Favourites filter.
- Preview rebuilds on the main thread, throttled to one rebuild per animation
  frame; export builds run in a Web Worker.
- Thumbnails: one offscreen renderer renders meshes to images (no WebGL
  context per tile).
- Mobile (< 900 px): viewport on top, panels in a tabbed bottom sheet.
- Keyboard: `Space` shuffle (Explore), `1/2/3` modes, `Cmd/Ctrl+S` save.

## 7. Errors

- Invalid URL payload: toast, keep current design.
- Mesh validation failure (should not happen): preview still shows the mesh,
  export buttons disabled with message; a property test guards this.
- IndexedDB unavailable (private mode): history disabled with a note; app
  works.
- Worker failure: fall back to main-thread export.

## 8. Testing (TDD)

- Unit (Vitest, node): prng determinism, coefficients (envelope, symmetry,
  edits, truncation), surface (separable sum equals naive sum), modifiers,
  fit, every body builder, validate (detects holes and flipped faces), stats
  (cube/cylinder analytic volume), STL and 3MF parse-back, codec round trip,
  mutate bounds.
- Property: 100 random designs × 4 body kinds ⇒ closed, oriented, positive
  volume, inside bed, deterministic.
- Components (Vitest + Testing Library, jsdom): mode switch, sliders update
  the store, heatmap K/M handle, history drawer with fake-indexeddb, i18n
  toggle.
- E2E (Playwright, chromium): load ⇒ shuffle ⇒ select ⇒ refine ⇒ change a
  slider ⇒ print ⇒ hollow ⇒ download 3MF and STL and parse them; share URL
  reload reproduces the design.

## 9. Delivery

- CI: GitHub Actions on Node 22: `npm ci`, typecheck, `vitest run`,
  `vite build`, Playwright.
- Netlify project `leonardo-design`; `netlify.toml`: `npm run build`, publish
  `dist`, SPA fallback, cache headers for assets.
- Phases (commits on `rework-ts`, each builds and passes tests):
  1. Engine + preview + download (walking skeleton), deployable.
  2. Spectrum editor, recipe sliders, modifiers.
  3. Body types, printer/bed, overhang heatmap, stats.
  4. Explore/variations, history, share URL, i18n, mobile, Python removal,
     README.
