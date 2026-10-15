import { defaultDesign, normaliseDesign, RANGES } from './schema';

describe('normaliseDesign', () => {
  it('keeps a valid design unchanged', () => {
    const d = defaultDesign(123);
    expect(normaliseDesign(d)).toEqual(d);
  });

  it('rejects non-objects and missing seeds', () => {
    expect(normaliseDesign(null)).toBeNull();
    expect(normaliseDesign('x')).toBeNull();
    expect(normaliseDesign({})).toBeNull();
  });

  it('clamps numbers into range', () => {
    const d = defaultDesign(1);
    const out = normaliseDesign({
      ...d,
      spectrum: { ...d.spectrum, K: 999, M: -3, recipe: { ...d.spectrum.recipe, bulge: 7 } },
      modifiers: { twist: -10, edginess: 99 },
    })!;
    expect(out.spectrum.K).toBe(RANGES.K[1]);
    expect(out.spectrum.M).toBe(RANGES.M[0]);
    expect(out.spectrum.recipe.bulge).toBe(1);
    expect(out.modifiers.twist).toBe(-2);
    expect(out.modifiers.edginess).toBe(5);
  });

  it('rounds integer fields', () => {
    const d = defaultDesign(1);
    const out = normaliseDesign({
      ...d,
      spectrum: { ...d.spectrum, K: 4.6, recipe: { ...d.spectrum.recipe, symmetry: 2.4 } },
    })!;
    expect(out.spectrum.K).toBe(5);
    expect(out.spectrum.recipe.symmetry).toBe(2);
  });

  it('falls back to defaults for unknown enums and missing parts', () => {
    const d = defaultDesign(9);
    const out = normaliseDesign({ v: 1, seed: 9, body: { kind: 'teapot' }, print: { printer: 'nope' } })!;
    expect(out.body.kind).toBe(d.body.kind);
    expect(out.print.printer).toBe(d.print.printer);
    expect(out.spectrum).toEqual(d.spectrum);
  });

  it('drops neutral and invalid edits, clamps gains', () => {
    const d = defaultDesign(1);
    const out = normaliseDesign({
      ...d,
      spectrum: { ...d.spectrum, edits: { '1,2': 1, '2,3': 9, 'x,y': 2, '99,1': 2, '3,4': 0.5 } },
    })!;
    expect(out.spectrum.edits).toEqual({ '2,3': 4, '3,4': 0.5 });
  });

  it('coerces the seed to uint32', () => {
    expect(normaliseDesign({ seed: -1 })!.seed).toBe(4294967295);
  });
});
