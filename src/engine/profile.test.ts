import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  archetypeProfile,
  footFactor,
  heightForProportion,
  rimFactor,
  smoothstep,
} from './profile';

describe('archetypeProfile', () => {
  it('passes through every control point', () => {
    for (const id of ARCHETYPE_IDS) {
      for (const [h, r] of ARCHETYPES[id].points) expect(archetypeProfile(id, h)).toBeCloseTo(r, 12);
    }
  });

  it('never overshoots between control points (monotone cubic)', () => {
    for (const id of ARCHETYPE_IDS) {
      const pts = ARCHETYPES[id].points;
      for (let i = 0; i + 1 < pts.length; i++) {
        const lo = Math.min(pts[i][1], pts[i + 1][1]);
        const hi = Math.max(pts[i][1], pts[i + 1][1]);
        for (let s = 1; s < 20; s++) {
          const h = pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * s) / 20;
          const r = archetypeProfile(id, h);
          expect(r).toBeGreaterThanOrEqual(lo - 1e-12);
          expect(r).toBeLessThanOrEqual(hi + 1e-12);
        }
      }
    }
  });

  it('keeps every archetype within (0, 1] with a maximum of 1', () => {
    for (const id of ARCHETYPE_IDS) {
      let max = 0;
      for (let i = 0; i <= 200; i++) {
        const r = archetypeProfile(id, i / 200);
        expect(r).toBeGreaterThan(0);
        max = Math.max(max, r);
      }
      expect(max).toBeCloseTo(1, 6);
    }
  });

  it('is constant for the cylinder', () => {
    expect(archetypeProfile('cylinder', 0.37)).toBe(1);
  });
});

describe('form factors', () => {
  it('maps proportion 0..1 to slender..squat raw height', () => {
    expect(heightForProportion(0)).toBeCloseTo(4.4, 12);
    expect(heightForProportion(1)).toBeCloseTo(1.0, 12);
  });

  it('smoothstep is 0 below, 1 above, 0.5 in the middle', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('flat rim changes nothing; flare widens the top only', () => {
    expect(rimFactor('flat', 1, true)).toBe(1);
    expect(rimFactor('flare', 0.5, true)).toBe(1);
    expect(rimFactor('flare', 1, false)).toBeCloseTo(1.14, 12);
  });

  it('round rim rounds the top edge of solids only', () => {
    expect(rimFactor('round', 0.9, true)).toBe(1);
    expect(rimFactor('round', 1, true)).toBeCloseTo(0.88, 12);
    expect(rimFactor('round', 1, false)).toBe(1);
  });

  it('foot narrows the base and leaves the body alone', () => {
    expect(footFactor(0, 0)).toBe(1);
    expect(footFactor(1, 0)).toBeCloseTo(0.7, 12);
    expect(footFactor(1, 0.5)).toBe(1);
  });
});
