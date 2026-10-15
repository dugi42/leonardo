import { sfc32 } from '../engine/prng';
import { defaultDesign, normaliseDesign } from './schema';
import { randomDesign, variation } from './mutate';

describe('randomDesign', () => {
  it('is deterministic per seed and uses that seed', () => {
    expect(randomDesign(11)).toEqual(randomDesign(11));
    expect(randomDesign(11).seed).toBe(11);
    expect(randomDesign(11)).not.toEqual(randomDesign(12));
  });

  it('is already normalised', () => {
    for (let s = 0; s < 50; s++) {
      const d = randomDesign(s);
      expect(normaliseDesign(d)).toEqual(d);
    }
  });

  it('keeps body and print settings of a base design', () => {
    const base = { ...defaultDesign(1), body: { kind: 'hollow' as const, wallMm: 3, floorMm: 2, holeMm: 8 } };
    expect(randomDesign(5, base).body).toEqual(base.body);
    expect(randomDesign(5, base).print).toEqual(base.print);
  });

  it('varies the shape parameters across seeds', () => {
    const ks = new Set(Array.from({ length: 30 }, (_, s) => randomDesign(s).spectrum.K));
    expect(ks.size).toBeGreaterThan(3);
  });
});

describe('variation', () => {
  const parent = randomDesign(21);

  it('returns the parent unchanged at temperature 0', () => {
    expect(variation(parent, 0, sfc32(1))).toEqual(parent);
  });

  it('stays valid and differs at higher temperature', () => {
    const rng = sfc32(2);
    for (let i = 0; i < 30; i++) {
      const v = variation(parent, 1, rng);
      expect(normaliseDesign(v)).toEqual(v);
    }
    expect(variation(parent, 0.5, sfc32(3))).not.toEqual(parent);
  });

  it('moves further at higher temperature', () => {
    const dist = (t: number) => {
      const rng = sfc32(4);
      let sum = 0;
      for (let i = 0; i < 40; i++) {
        const v = variation(parent, t, rng);
        sum += Math.abs(v.spectrum.recipe.bulge - parent.spectrum.recipe.bulge);
      }
      return sum;
    };
    expect(dist(0.8)).toBeGreaterThan(dist(0.1));
  });

  it('keeps body and print settings', () => {
    const v = variation(parent, 1, sfc32(5));
    expect(v.body).toEqual(parent.body);
    expect(v.print).toEqual(parent.print);
  });
});
