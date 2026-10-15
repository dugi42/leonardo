# Leonardo 3 (TS Fourier vessel designer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python/Dash app with a static React + three.js app on Netlify that designs printable Fourier-spectrum vessels and exports watertight STL/3MF.

**Architecture:** Pure TS engine (`src/engine`) turns a small serialisable `Design` into a closed, outward-wound triangle mesh in millimetres. A zustand store holds the current design; React panels edit it; react-three-fiber renders the preview; a Web Worker builds export-resolution meshes. No server.

**Tech Stack:** React 19, Vite 8, TypeScript, three 0.186, @react-three/fiber 9, @react-three/drei 10, zustand 5, fflate, idb-keyval, Vitest 5 + Testing Library + jsdom + fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-ts-fourier-rework-design.md`

## Global Constraints

- Node 22 in CI and on Netlify (`NODE_VERSION = "22"`).
- `KMAX = 24`, `MMAX = 32`, `H0 = 2.5`, `rMin = 0.15`, bed margin 10 mm per side.
- Preview grid 96 × 128 (Nh × Nφ), export grid 256 × 384.
- PRNG is sfc32; `Math.random` only for drawing fresh seeds in the UI.
- Every mesh: closed, oriented 2-manifold, positive signed volume, z-min 0.
- Body wall/floor minimum 0.8 mm; hole ≤ 0.6 × smallest relevant ring radius.
- UI strings only through `t(key)`; `en` and `de` dictionaries have identical keys.
- File names `leonardo-<seed>-<body>.<ext>`.
- Commit after each task; conventional commit messages.

## File map

| File | Responsibility |
|---|---|
| `src/engine/prng.ts` | `sfc32(seed)`, `randomSeed()` |
| `src/engine/constants.ts` | KMAX, MMAX, H0, R_MIN, grids |
| `src/engine/spectrum.ts` | `Coefficients`, `baseCoefficients`, `coefficients(design.spectrum, seed)` |
| `src/engine/surface.ts` | `radiusField(coeffs, K, M, modifiers, nh, nphi)` |
| `src/engine/printers.ts` | `PRINTERS`, `PrinterId`, `printerById` |
| `src/engine/fit.ts` | `printScale(field, design)` |
| `src/engine/body.ts` | `buildBody(field, scale, body)` → `Mesh` |
| `src/engine/mesh.ts` | `Mesh` type, `buildMesh(design, res)` |
| `src/engine/validate.ts` | `checkMesh(mesh)` |
| `src/engine/stats.ts` | `meshStats(mesh, body)`, `faceOverhang(mesh)` |
| `src/engine/export/stl.ts` | `toStl(mesh, name)` |
| `src/engine/export/threemf.ts` | `to3mf(mesh, meta)` |
| `src/design/schema.ts` | `Design`, `defaultDesign`, `normaliseDesign` |
| `src/design/codec.ts` | `encodeDesign`, `decodeDesign` |
| `src/design/mutate.ts` | `randomDesign(seed)`, `variation(d, temperature, rng)` |
| `src/state/store.ts` | zustand store |
| `src/storage/history.ts` | IndexedDB history |
| `src/i18n/*` | dictionaries and `useT` |
| `src/worker/*` | export worker + client |
| `src/ui/*` | components |

---

## Phase 1 — walking skeleton

### Task 1: Scaffold Vite React TS app with Vitest

**Files:** Create `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/ui/App.tsx`, `src/test/setup.ts`, `netlify.toml`, update `.gitignore`.

- [ ] `npm init` equivalent by writing `package.json` with scripts `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `e2e` (`playwright test`), `typecheck`.
- [ ] Install deps listed in Tech Stack.
- [ ] Vitest config inside `vite.config.ts`: `environment: 'node'` default, `environmentMatchGlobs`-equivalent via `// @vitest-environment jsdom` docblock in UI tests, `setupFiles: src/test/setup.ts` (jest-dom matchers, fake-indexeddb/auto).
- [ ] Smoke test `src/ui/App.test.tsx` renders the app title. Run `npm test` → PASS. `npm run build` → PASS.
- [ ] `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
[build.environment]
  NODE_VERSION = "22"
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

- [ ] Commit `chore: scaffold vite react ts app`.

### Task 2: Seeded PRNG

**Files:** `src/engine/prng.ts`, `src/engine/prng.test.ts`
**Produces:** `type Rng = () => number` (uniform [0,1)), `sfc32(seed: number): Rng`, `uniform(rng, lo, hi)`, `intBetween(rng, lo, hiInclusive)`, `randomSeed(): number`.

Tests:
```ts
it('is deterministic', () => {
  const a = sfc32(42), b = sfc32(42);
  expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
});
it('differs per seed', () => expect(sfc32(1)()).not.toBe(sfc32(2)()));
it('stays in [0,1)', () => { const r = sfc32(7); for (let i = 0; i < 1e4; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); } });
it('has a sane mean', () => { const r = sfc32(9); let s = 0; for (let i = 0; i < 1e4; i++) s += r(); expect(s / 1e4).toBeCloseTo(0.5, 1); });
```

Implementation: sfc32 with state seeded from `seed` via splitmix32, 12 warm-up draws.

### Task 3: Design schema

**Files:** `src/design/schema.ts`, test.
**Produces:** types from spec §2, `RECIPE_RANGES`, `defaultDesign(seed): Design`, `normaliseDesign(input: unknown): Design | null` (clamps numbers, rounds integers, drops gains equal to 1 and invalid keys).

Tests: clamps out-of-range values; integer fields rounded; invalid kind → default kind; `normaliseDesign(defaultDesign(1))` equals input; garbage (`null`, `{}` without seed) → `null`.

### Task 4: Spectrum coefficients

**Files:** `src/engine/constants.ts`, `src/engine/spectrum.ts`, test.
**Produces:** `interface Coefficients { C: Float64Array; S: Float64Array }` (row-major `k*MMAX+m`), `coefficients(seed: number, spectrum: Design['spectrum']): Coefficients` (truncated, edited), `fullCoefficients(seed, recipe)` (untruncated, unedited, for the heatmap), `magnitude(c, k, m)`.

Algorithm: draw `u[k][m], w[k][m]` uniform [-1,1] in row-major order for all KMAX×MMAX (always, so sliders never reshuffle). `C00 = 1`, `S[k][0] = 0`. Envelope per spec §3. Symmetry, ribs, edits (gain), truncation.

Tests: deterministic per seed; `C00 === 1`; all-zero recipe → only C00 non-zero; symmetry 4 → every non-zero m>0 divisible by 4; truncation K=3,M=5 zeroes rest; edit gain 2 doubles both C and S at that cell; changing bulge scales k>0,m=0 linearly without changing signs.

### Task 5: Radius field

**Files:** `src/engine/surface.ts`, test.
**Produces:** `interface Field { nh: number; nphi: number; r: Float64Array /* nh*nphi */; phi: Float64Array }`, `radiusField(c: Coefficients, mods: Design['modifiers'], nh, nphi): Field`.

Separable sum; twist evaluates at `φ − 2π·twist·h`; edginess factor normalised to mean 1; clamp `r ≥ R_MIN`.

Tests: C00 only → r ≡ 1; separable result equals naive double sum at 10 random points (1e-9); twist with only `C[0][3]` shifts the angular pattern by `2π·twist·h` at h=1; edginess 0 is identity; edginess>0 mean over φ ≈ unchanged (within 2 %); clamp holds.

### Task 6: Printers and print scale

**Files:** `src/engine/printers.ts`, `src/engine/fit.ts`, tests.
**Produces:** `PRINTERS: Printer[]` (spec §4 table), `printerById(id)`, `printScale(field, print): { sigma: number; heightMm: number; capped: boolean; offset: [number, number] }`.

`sigma = min(heightMm / H0, printer.height / H0, (bedX − 20) / widthX, (bedY − 20) / widthY)`; offset recentres the xy bbox.

Tests: unit cylinder (r ≡ 1) height 100 on X1C → sigma 40, not capped; height 300 on A1 mini → limits are build height 180/2.5 = 72 and bed 160/2 = 80, so sigma 72, heightMm 180, capped; very wide field gets capped by bed.

### Task 7: Mesh, validation, solid body

**Files:** `src/engine/mesh.ts`, `src/engine/validate.ts`, `src/engine/body.ts` (solid only), tests.
**Produces:** `interface Mesh { positions: Float32Array; indices: Uint32Array }`, `checkMesh(mesh): { ok: boolean; reason?: string; volume: number }`, `buildBody(field, scale, body): Mesh`, `buildMesh(design: Design, res: 'preview' | 'export'): BuiltMesh` where `BuiltMesh = { mesh: Mesh; scale: PrintScale; field: Field }`.

Stitching (outward winding, rings CCW seen from +z):
```ts
// outer strip between ring a (lower) and b (upper)
tri(a+j, a+j1, b+j1); tri(a+j, b+j1, b+j);
// inner strip (normals toward axis)
tri(a+j, b+j1, a+j1); tri(a+j, b+j, b+j1);
// cap facing down / up with centre c
tri(c, a+j1, a+j);    tri(c, b+j, b+j1);
// annulus between inner ring i and outer ring o, facing up / down
tri(i+j, o+j, o+j1); tri(i+j, o+j1, i+j1);
tri(i+j, o+j1, o+j); tri(i+j, i+j1, o+j1);
```

Validation tests: closed tetrahedron ok with volume 1/6; removing a face → `not closed`; flipping one face → `inconsistent orientation`; flipping all → `negative volume`.
Solid tests: unit cylinder design volume ≈ `0.5·N·sin(2π/N)·R²·H` (1e-6 rel); `checkMesh` ok; z-min 0; height = `heightMm`.

### Task 8: STL and 3MF export

**Files:** `src/engine/export/stl.ts`, `src/engine/export/threemf.ts`, tests.
**Produces:** `toStl(mesh, name): Uint8Array`, `to3mf(mesh, { title, description }): Uint8Array`, `fileName(design, ext)`.

Tests: STL byte length `84 + 50·nFaces`, header count matches, first normal points outward on the unit cylinder side face; 3MF unzips (fflate `unzipSync`) to the three required entries, model XML has `unit="millimeter"` and `nVertices` `<vertex` and `nFaces` `<triangle` elements.

### Task 9: Skeleton UI + store + preview + download

**Files:** `src/state/store.ts`, `src/ui/App.tsx`, `src/ui/Viewport.tsx`, `src/ui/TopBar.tsx`, `src/ui/theme.css`, `src/ui/download.ts`, tests.
**Produces:** `useStore` with `design`, `setDesign(fn | partial)`, `newSeed()`, `mode`, `setMode`; `downloadBytes(bytes, name, mime)`.

Viewport: r3f `Canvas`, `OrbitControls`, mesh geometry built from `buildMesh(design,'preview')` in `useMemo`, studio lighting, grid floor. Top bar: "New design", "STL", "3MF".

Tests (jsdom, Viewport mocked): clicking "New design" changes the seed in the store; clicking STL calls `downloadBytes` with a `.stl` name.

- [ ] Build, deploy to Netlify (`netlify sites:create --name leonardo-design`, `netlify deploy --prod --dir dist`). Commit `feat: walking skeleton`.

## Phase 2 — Refine

### Task 10: Slider and panel primitives + Refine panel

**Files:** `src/ui/controls/Slider.tsx`, `src/ui/panels/RefinePanel.tsx`, tests.
Slider: label, value readout, `<input type=range>`, double-click resets to default, keyboard accessible. RefinePanel: recipe sliders, twist, edginess, new seed. Tests: changing the bulge slider updates `design.spectrum.recipe.bulge`; double-click resets.

### Task 11: Spectrum heatmap editor

**Files:** `src/ui/panels/SpectrumEditor.tsx`, `src/ui/panels/spectrumColor.ts`, tests.
SVG KMAX×MMAX cells coloured by `log10(magnitude)` of `fullCoefficients` × edits; kept K×M rectangle outlined; corner handle drag sets K, M (pointer events → cell coordinate); brush modes boost/damp/off apply gain ×1.25 / ×0.8 per cell entered while pressed; "Reset edits". Tests: dragging the handle to cell (k=5, m=7) sets K=6, M=8; boost click on (2,3) sets edit `"2,3"` to 1.25; reset clears edits; colour function monotone.

### Task 12: Undo / redo

**Files:** `src/state/store.ts`, test. `past`/`future` stacks (cap 100); `setDesign` coalesces changes within 400 ms into one entry; `undo()`, `redo()`; Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z. Tests: three quick changes undo in one step; separated changes undo individually; redo after undo restores.

## Phase 3 — Print

### Task 13: Hollow and planter bodies (vase = solid)

**Files:** `src/engine/body.ts`, test.
Hollow per spec §3, planter adds hole tube and annuli. Tests: hollow unit cylinder volume ≈ outer − inner analytic; planter volume ≈ hollow − hole cylinder through floor; all `checkMesh` ok; vase mesh equals solid mesh.

### Task 14: Property test over random designs

**Files:** `src/engine/property.test.ts`. 100 `randomDesign(seed)` × 4 kinds at preview resolution: `checkMesh` ok, bbox inside bed minus margin, height ≤ printer height, z-min 0, deterministic (two builds identical).

### Task 15: Stats and overhang

**Files:** `src/engine/stats.ts`, test.
**Produces:** `meshStats(mesh, kind): { size: [x,y,z]; volumeMm3; areaMm2; overhangAreaMm2; grams }`, `faceOverhang(mesh): Float32Array` (per vertex 0..1 for colouring: 1 where adjacent face overhangs > 45°).
Tests: cube-like solid volume; upside-down cone has overhang area > 0, upright cone 0; grams formula.

### Task 16: Print panel and bed view

**Files:** `src/ui/panels/PrintPanel.tsx`, `src/ui/Bed.tsx`, viewport overhang colouring, tests.
Printer select, height input, body kind segmented control, wall/floor/hole inputs (shown per kind), overhang toggle, stats card, capped-height warning, vase hint. Tests: selecting hollow shows wall input; capped message appears for A1 mini at 300 mm.

## Phase 4 — Explore, history, share, polish

### Task 17: randomDesign and variations

**Files:** `src/design/mutate.ts`, test. `randomDesign(seed)` draws recipe, K, M, twist, edginess from seed; `variation(d, temperature, rng)` jitters each numeric by `temperature × range × N(0, 0.25)` clamped, changes seed with probability `temperature × 0.5`. Tests: deterministic; temperature 0 returns equal design; outputs normalised.

### Task 18: Explore mode with thumbnails

**Files:** `src/ui/explore/ExploreGrid.tsx`, `src/ui/thumbnail.ts`, tests.
One shared offscreen `WebGLRenderer` renders each design to a data URL (cached by encoded design). Grid: Shuffle, Variations (with temperature), select, Refine. Space = shuffle. Tests (thumbnail mocked): shuffle produces 9 new seeds; variations keep selected tile and replace 8; Refine sets store design and mode.

### Task 19: Share URL codec + hash sync

**Files:** `src/design/codec.ts`, `src/ui/useHashSync.ts`, tests. Short-key JSON → base64url. Tests: round trip, tolerant decode (`null` on garbage, wrong version), hash load sets design, Share copies URL.

### Task 20: History drawer (IndexedDB)

**Files:** `src/storage/history.ts`, `src/ui/HistoryDrawer.tsx`, tests (fake-indexeddb). Entries `{ id, design, thumb, created, starred }`. Save on export/share/star/Cmd+S. Drawer list, favourites filter, open, delete. Tests: save + list order newest first, star toggles, delete removes, open sets design.

### Task 21: i18n EN/DE

**Files:** `src/i18n/en.ts`, `src/i18n/de.ts`, `src/i18n/index.ts`, test. `useT()`, language in store persisted in localStorage (try/catch). Test: key sets identical; toggle switches visible labels.

### Task 22: Mobile layout, keyboard, export worker

**Files:** `src/ui/App.tsx`, `src/ui/theme.css`, `src/worker/export.worker.ts`, `src/worker/client.ts`. Bottom sheet tabs < 900 px; worker builds export mesh + bytes, fallback on error.

### Task 23: Remove Python, docs, CI, e2e, deploy

- Delete `leonardo/`, `tests/`, `pyproject.toml`, `uv.lock`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `config.yml`, `output/`.
- Rewrite `README.md`, `CHANGELOG.md` (3.0.0).
- `.github/workflows/ci.yml`: Node 22, `npm ci`, typecheck, unit tests, build, Playwright.
- `e2e/flow.spec.ts`: explore → refine (slider) → print (hollow) → download STL + 3MF and parse; share URL reload reproduces seed.
- Deploy prod, open PR.
