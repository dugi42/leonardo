import { defaultDesign, type Spectrum } from '../design/schema';
import { KMAX, MMAX } from './constants';
import { coefficients, editedCoefficients, fullCoefficients, idx, magnitude } from './spectrum';

const spec = (patch: Partial<Spectrum> = {}): Spectrum => ({ ...defaultDesign(1).spectrum, ...patch });
const recipe = (patch: Partial<Spectrum['recipe']>) => ({ ...defaultDesign(1).spectrum.recipe, ...patch });
const full = { K: KMAX, M: MMAX };

describe('fullCoefficients', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = fullCoefficients(5, spec().recipe);
    const b = fullCoefficients(5, spec().recipe);
    const c = fullCoefficients(6, spec().recipe);
    expect(a.C).toEqual(b.C);
    expect(a.C).not.toEqual(c.C);
  });

  it('has no mean term (the form sets the size) and no sine at m = 0', () => {
    const c = fullCoefficients(5, spec().recipe);
    expect(c.C[idx(0, 0)]).toBe(0);
    for (let k = 0; k < KMAX; k++) expect(c.S[idx(k, 0)]).toBe(0);
  });

  it('is a plain cylinder when every recipe amplitude is zero', () => {
    const c = fullCoefficients(5, recipe({ bulge: 0, flutes: 0, ribs: 0 }));
    let nonzero = 0;
    for (let i = 0; i < KMAX * MMAX; i++) if (c.C[i] !== 0 || c.S[i] !== 0) nonzero++;
    expect(nonzero).toBe(0);
  });

  it('keeps only multiples of the symmetry order', () => {
    const c = fullCoefficients(5, recipe({ symmetry: 4 }));
    for (let k = 0; k < KMAX; k++)
      for (let m = 1; m < MMAX; m++)
        if (m % 4 !== 0) expect(magnitude(c, k, m)).toBe(0);
    expect(magnitude(c, 1, 4)).toBeGreaterThan(0);
  });

  it('scales the profile terms linearly with bulge', () => {
    const a = fullCoefficients(5, recipe({ bulge: 0.25 }));
    const b = fullCoefficients(5, recipe({ bulge: 0.5 }));
    expect(b.C[idx(3, 0)]).toBeCloseTo(2 * a.C[idx(3, 0)], 12);
    expect(b.C[idx(3, 2)]).toBe(a.C[idx(3, 2)]);
  });

  it('adds ribs at the rib frequency', () => {
    const base = fullCoefficients(5, recipe({ ribs: 0, ribFrequency: 9 }));
    const ribbed = fullCoefficients(5, recipe({ ribs: 1, ribFrequency: 9 }));
    expect(ribbed.C[idx(0, 9)] - base.C[idx(0, 9)]).toBeCloseTo(0.12, 12);
  });
});

describe('coefficients', () => {
  it('truncates to the K x M rectangle', () => {
    const c = coefficients(5, spec({ K: 3, M: 5 }));
    for (let k = 0; k < KMAX; k++)
      for (let m = 0; m < MMAX; m++)
        if (k >= 3 || m >= 5) expect(magnitude(c, k, m)).toBe(0);
    expect(magnitude(c, 2, 4)).toBeGreaterThan(0);
  });

  it('applies edits as magnitude gains keeping phase', () => {
    const plain = coefficients(5, spec({ ...full }));
    const edited = coefficients(5, spec({ ...full, edits: { '2,3': 2 } }));
    expect(edited.C[idx(2, 3)]).toBeCloseTo(2 * plain.C[idx(2, 3)], 12);
    expect(edited.S[idx(2, 3)]).toBeCloseTo(2 * plain.S[idx(2, 3)], 12);
  });

  it('never edits the mean term', () => {
    const edited = coefficients(5, spec({ edits: { '0,0': 3 } }));
    expect(edited.C[idx(0, 0)]).toBe(0);
  });

  it('injects energy when boosting an empty cell', () => {
    const sym = spec({ K: KMAX, M: MMAX, recipe: recipe({ symmetry: 4 }), edits: { '1,3': 2 } });
    expect(magnitude(fullCoefficients(5, sym.recipe), 1, 3)).toBe(0);
    expect(editedCoefficients(5, sym).C[idx(1, 3)]).toBeCloseTo(0.05, 12);
    expect(coefficients(5, sym).C[idx(1, 3)]).toBeCloseTo(0.05, 12);
  });

  it('damping an empty cell keeps it empty', () => {
    const sym = spec({ K: KMAX, M: MMAX, recipe: recipe({ symmetry: 4 }), edits: { '1,3': 0.5 } });
    expect(magnitude(coefficients(5, sym), 1, 3)).toBe(0);
  });
});
