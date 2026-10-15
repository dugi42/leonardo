# Leonardo 3.1: form language, spectrum editor, polish, materials

Date: 2026-10-15
Status: approved (review follow-up: options A + C + E, then B)

## Problem

The review of 3.0 found four problems:

- Every design has the same proportions (about 1:1).
- The profile is random wobble around a cylinder, with no foot, belly, neck or lip.
- Deep flutes hit the hard radius clamp and turn into flat star plateaus.
- The rim is a flat cut.

The spectrum heatmap is mostly black, and brushes do nothing on empty cells. Several smaller UX problems also showed up in the review.

## A. Form language

### Shape model

```text
r(h, φ) = base(h) · rim(h) · foot(h) · exp(D(h, φ))
D(h, φ) = Σ_k Σ_m (C_km cos mφ + S_km sin mφ) cos(πkh),   C_00 = 0
```

- `base(h)` is the archetype profile: a monotone-cubic interpolation through control
  points, with relative radius at most 1.
- The spectrum now describes the **log radius**:
  - `exp` keeps every radius positive, so deep flutes become sharp ridges instead of
    clamped plateaus.
  - A detail amplitude scales with the local radius, so narrow necks get finer
    flutes.
  - The `R_MIN` floor stays as a safety net that is rarely reached.
- `C_00` is 0. Overall size comes from the base profile, so the (0,0) heatmap cell is
  shown as "form" and cannot be edited.
- `PROFILE_RMS` drops to 0.3, so the archetype dominates and `bulge` adds character on
  top.

### Archetypes

Each archetype has control points `(h, r)` and a default proportion.

| id | profile | default proportion |
|---|---|---|
| cylinder | (0,1) (1,1) | 0.45 |
| tumbler | (0,0.8) (1,1) | 0.5 |
| vase | (0,0.55) (0.12,0.62) (0.42,1) (0.76,0.6) (0.9,0.5) (1,0.58) | 0.25 |
| bottle | (0,0.9) (0.5,1) (0.66,0.78) (0.78,0.38) (1,0.34) | 0.2 |
| bowl | (0,0.5) (0.3,0.8) (0.7,0.97) (1,1) | 0.9 |
| lantern | (0,0.62) (0.5,1) (1,0.62) | 0.4 |
| amphora | (0,0.38) (0.1,0.46) (0.45,1) (0.75,0.7) (0.88,0.44) (1,0.52) | 0.3 |

### Proportion

The raw height is `H(p) = 4.4 − 3.4·p` for proportion `p ∈ [0, 1]`, so 0 is slender
and 1 is squat. `Field` carries `height`; print scaling and the body builders use
`field.height` instead of the old `H0` constant.

### Rim

| rim | solid, vase | hollow, planter |
|---|---|---|
| `flat` | as today | as today |
| `round` | profile × `1 − 0.12(1 − √(1 − t²))` over the top 5 % of the height | half-round lip: arc rings join the outer and inner top rings, diameter = wall |
| `flare` | profile × `1 + 0.14·smoothstep(0.86, 1, h)` | same |

### Foot

`foot ∈ [0, 1]` sets a pedestal: profile × `1 − 0.3·foot·(1 − smoothstep(0, L, h))`,
with `L = 0.05 + 0.1·foot`.

### Random designs

- Each random design draws an archetype and a proportion of its default ± 0.12.
- Rim: flat 50 %, round 30 %, flare 20 %.
- Foot: 30 % of designs get a foot of 0.3–1.
- Symmetry probability rises to 0.7, and the lean term (m = 1) weight drops to 0.15.

### Data model and codec

`Design.form = { archetype, proportion, rim, foot }`. The wire format moves to
`v: 2` with an added `f` field.

v1 payloads still decode: they map to the cylinder archetype with proportion 0.56
(raw height 2.5), a flat rim and no foot. Shapes differ from 3.0 because the spectrum
is now in the log domain, and the changelog says so.

## C. Spectrum editor

- **Colour:** magnitude relative to the strongest term over two decades. Empty cells
  draw as a faint outline. Tick labels every 8 cells on both axes.
- **Hover:** a fixed-height status line reads `k 3 · m 8 · 0.042 · ×1.6` (no layout
  jump). While a cell is hovered, the 3D model is tinted by that cell's basis function
  `cos(πkh)·cos(mφ − phase)`: positive regions amber, negative teal.
- **Brushes:** Boost ×1.6 per pass and Damp ×0.5 per pass.
  - A boost on an empty cell (magnitude < 0.01) injects `0.05·(g − 1)` into C, capped
    at g = 4.
  - The edit counter sits inside the fixed status line.

## E. Polish

- The Netlify "built with" badge is turned off in the site settings (done).
- The viewport shows a visible loading state ("Loading 3D view…") while three.js
  loads.
- Export buttons show a busy state, and a second click during an export is ignored.
- Overhang view:
  - A HUD chip shows the overhang area.
  - A "View from below" camera preset is added.
  - In print mode the bed turns translucent while viewed from below.
- Variation tiles are labelled "Parent" and "Variation 1–8". The seed appears in the
  tooltip.

## B. Materials and stage

- Design gains `look = { color, finish }`.
- Colours are a curated palette of common PLA colours (approximate hex values):
  white, black, grey, red, orange, yellow, green, blue, cyan, purple, pink, brown,
  beige.
- Finishes: matte, basic, silk, which map to the physical material's roughness,
  metalness and sheen.
- The 3MF gets `<basematerials>` with `displaycolor`, and the object references it.
- A turntable toggle in the HUD auto-rotates the camera (the frameloop runs only while
  it is on).

## Testing

- Unit tests:
  - Archetype interpolation: it passes through the control points and is monotone
    between them.
  - Proportion maps to height.
  - Rim and foot factors.
  - Log-domain field: equals `base·exp(naive sum)`.
  - Rounded-lip body: closed, with the analytic volume increase.
  - Codec v1 → v2 mapping.
  - Additive injection.
  - 3MF `basematerials`.
- The property test extends over archetypes × rims × bodies.
- Component tests:
  - The hover status line.
  - The boost on an empty cell changes the coefficients.
  - The export busy state.
  - Variation labels.
  - The finish and colour pickers.
- The e2e test is updated.
