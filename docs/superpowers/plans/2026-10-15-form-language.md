# Leonardo 3.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement the form language, the spectrum editor rework, polish and materials.

**Spec:** `docs/superpowers/specs/2026-10-15-form-language-design.md`

**Constraints:**

- Every step is test-first.
- Each task must keep these passing: `npm test`, `npm run typecheck`, `npm run e2e`.
- The design model version moves to `v: 2`.
- Branch: `form-language`.

## Tasks

- [ ] **1. Profile module.** Write `src/engine/profile.ts`:
  - `ARCHETYPES`, `archetypeProfile(id, h)` (monotone cubic interpolation).
  - `heightForProportion(p)`, `rimFactor(rim, kind, h)`, `footFactor(foot, h)`.
  - Tests: passes through the control points, stays monotone between them, endpoints
    are right.
- [ ] **2. Schema v2.** Add `form` to `Design`:
  - Defaults, ranges and normalisation.
  - `randomDesign` draws a form.
  - `variation` jitters proportion and occasionally swaps the rim.
  - Codec `v: 2`, with v1 mapped onto it.
- [ ] **3. Log-domain spectrum.**
  - Set `C00 = 0`, `PROFILE_RMS = 0.3`, lean weight 0.15.
  - Empty-cell injection.
  - Field = `base · rim · foot · exp(D)`; `Field.height` replaces `H0` in fit and
    body.
  - Update the surface, spectrum and fit tests.
- [ ] **4. Rounded lip.** Hollow and planter `round` rim: arc rings chained with
  `outer()` from the outer top ring to the inner top ring. Tests: closed mesh, and
  volume above flat.
- [ ] **5. Property test.** Extend it to archetypes × rims × bodies × feet.
- [ ] **6. Form panel UI.** Add a "Form" section at the top of Refine:
  - An archetype picker: segmented buttons with small profile glyphs drawn as SVG
    paths from the control points.
  - A proportion slider, a rim segmented control and a foot slider.
  - Add the i18n keys.
- [ ] **7. Spectrum editor rework.**
  - Colour over two decades; empty cells drawn as outlines; tick labels.
  - A fixed status line that also shows the hover readout.
  - Brush factors ×1.6 and ×0.5; the (0,0) cell is shown as form and locked.
  - Store `hoverCell`; the viewport tints by the basis function.
- [ ] **8. Polish.**
  - Viewport loading state.
  - Export busy state and double-click guard.
  - Overhang chip, "View from below" camera preset and translucent bed.
  - Variation tile labels.
- [ ] **9. Materials and stage.**
  - `look` in the schema and codec; a colour palette and finish picker in the Print
    panel.
  - Material mapping in the viewport and thumbnails.
  - 3MF `basematerials`.
  - Turntable toggle.
- [ ] **10. Docs and release.**
  - Changelog 3.1.0, README section, refreshed screenshots.
  - Run e2e, open a PR, deploy.
