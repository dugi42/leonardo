import { defaultDesign, type Form } from '../design/schema';
import { KMAX, MMAX, R_MIN } from './constants';
import { archetypeProfile, heightForProportion } from './profile';
import { coefficients, idx, type Coefficients } from './spectrum';
import { DETAIL_MAX, radiusField } from './surface';

const none = { twist: 0, edginess: 0 };
const cyl: Form = { archetype: 'cylinder', proportion: 0.5, rim: 'flat', foot: 0 };
const shape = (mods = none, form = cyl) => ({ modifiers: mods, form });

function only(entries: [number, number, number, number][]): Coefficients {
  const C = new Float64Array(KMAX * MMAX);
  const S = new Float64Array(KMAX * MMAX);
  for (const [k, m, c, s] of entries) {
    C[idx(k, m)] = c;
    S[idx(k, m)] = s;
  }
  return { C, S };
}

function naive(c: Coefficients, h: number, phi: number): number {
  let r = 0;
  for (let k = 0; k < KMAX; k++)
    for (let m = 0; m < MMAX; m++)
      r += (c.C[idx(k, m)] * Math.cos(m * phi) + c.S[idx(k, m)] * Math.sin(m * phi)) * Math.cos(Math.PI * k * h);
  return r;
}

describe('radiusField', () => {
  it('is the bare form when the spectrum is empty', () => {
    const f = radiusField(only([]), shape(), 5, 8);
    expect(f.nh).toBe(5);
    expect(f.nphi).toBe(8);
    for (const r of f.r) expect(r).toBeCloseTo(1, 12);
  });

  it('samples h from 0 to 1 inclusive and phi without the seam duplicate', () => {
    const f = radiusField(only([]), shape(), 5, 8);
    expect(Array.from(f.h)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(f.phi[1]).toBeCloseTo((2 * Math.PI) / 8, 12);
    expect(f.phi[7]).toBeLessThan(2 * Math.PI);
  });

  it('equals the naive double sum', () => {
    const c = coefficients(77, { ...defaultDesign(77).spectrum, K: KMAX, M: MMAX });
    const vase: Form = { ...cyl, archetype: 'vase' };
    const f = radiusField(c, shape(none, vase), 11, 16);
    for (const [i, j] of [[0, 0], [3, 5], [10, 15], [7, 2]]) {
      const expected = archetypeProfile('vase', f.h[i]) * Math.exp(DETAIL_MAX * Math.tanh(naive(c, f.h[i], f.phi[j]) / DETAIL_MAX));
      expect(f.r[i * 16 + j]).toBeCloseTo(Math.max(R_MIN, expected), 9);
    }
  });

  it('twist rotates the angular pattern by 2*pi*twist*h', () => {
    const c = only([[0, 3, 0.2, 0]]);
    const twist = 0.25;
    const f = radiusField(c, shape({ twist, edginess: 0 }), 3, 64);
    const i = 2; // h = 1
    const j = 10;
    const d = 0.2 * Math.cos(3 * (f.phi[j] - 2 * Math.PI * twist));
    const expected = Math.exp(DETAIL_MAX * Math.tanh(d / DETAIL_MAX));
    expect(f.r[i * 64 + j]).toBeCloseTo(expected, 12);
  });

  it('edginess keeps the mean radius and makes the section squarer', () => {
    const f = radiusField(only([]), shape({ twist: 0, edginess: 3 }), 2, 256);
    let mean = 0;
    for (let j = 0; j < 256; j++) mean += f.r[j] / 256;
    expect(mean).toBeCloseTo(1, 6);
    const atAxis = f.r[0]; // phi = 0
    const atCorner = f.r[32]; // phi = pi/4
    expect(atCorner).toBeGreaterThan(atAxis * 1.2);
  });

  it('saturates extreme detail so ridges stay printable', () => {
    const f = radiusField(only([[0, 4, 5, 0]]), shape(), 2, 64);
    expect(Math.max(...f.r)).toBeLessThanOrEqual(Math.exp(DETAIL_MAX) + 1e-9);
    expect(Math.min(...f.r)).toBeGreaterThanOrEqual(Math.exp(-DETAIL_MAX) - 1e-9);
  });

  it('never goes below R_MIN', () => {
    const tiny = { ...cyl, archetype: 'bottle' as const, foot: 1 };
    const f = radiusField(only([[0, 4, 5, 0]]), shape(none, tiny), 8, 64);
    expect(Math.min(...f.r)).toBeGreaterThanOrEqual(R_MIN);
  });

  it('carries the raw height of the proportion', () => {
    expect(radiusField(only([]), shape(none, { ...cyl, proportion: 0.2 }), 2, 8).height).toBe(heightForProportion(0.2));
  });

  it('applies rim and foot factors along the height', () => {
    const f = radiusField(only([]), shape(none, { ...cyl, rim: 'flare', foot: 1 }), 21, 8);
    expect(f.r[0]).toBeCloseTo(0.7, 9); // foot at h = 0
    expect(f.r[10 * 8]).toBeCloseTo(1, 9); // body
    expect(f.r[20 * 8]).toBeCloseTo(1.14, 9); // flared lip at h = 1
  });

  it('rounds the top edge only for closed tops', () => {
    const round: Form = { ...cyl, rim: 'round' };
    expect(radiusField(only([]), shape(none, round), 3, 8, true).r[2 * 8]).toBeCloseTo(0.88, 9);
    expect(radiusField(only([]), shape(none, round), 3, 8, false).r[2 * 8]).toBeCloseTo(1, 9);
  });
});
