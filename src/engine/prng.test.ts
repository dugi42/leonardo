import { intBetween, sfc32, uniform } from './prng';

describe('sfc32', () => {
  it('is deterministic for a seed', () => {
    const a = sfc32(42);
    const b = sfc32(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it('differs between seeds', () => {
    expect(sfc32(1)()).not.toBe(sfc32(2)());
  });

  it('stays in [0, 1) with mean near 0.5', () => {
    const r = sfc32(7);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });
});

describe('helpers', () => {
  it('uniform maps into [lo, hi)', () => {
    const r = sfc32(3);
    for (let i = 0; i < 1000; i++) {
      const x = uniform(r, -2, 5);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThan(5);
    }
  });

  it('intBetween hits both inclusive bounds', () => {
    const r = sfc32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(intBetween(r, 2, 4));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
});
