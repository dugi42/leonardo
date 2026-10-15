import { defaultDesign } from '../design/schema';
import { KMAX, MMAX, R_MIN } from './constants';
import { coefficients, idx, type Coefficients } from './spectrum';
import { radiusField } from './surface';

const none = { twist: 0, edginess: 0 };

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
  it('is a unit cylinder for the mean term alone', () => {
    const f = radiusField(only([[0, 0, 1, 0]]), none, 5, 8);
    expect(f.nh).toBe(5);
    expect(f.nphi).toBe(8);
    for (const r of f.r) expect(r).toBeCloseTo(1, 12);
  });

  it('samples h from 0 to 1 inclusive and phi without the seam duplicate', () => {
    const f = radiusField(only([[0, 0, 1, 0]]), none, 5, 8);
    expect(Array.from(f.h)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(f.phi[1]).toBeCloseTo((2 * Math.PI) / 8, 12);
    expect(f.phi[7]).toBeLessThan(2 * Math.PI);
  });

  it('equals the naive double sum', () => {
    const c = coefficients(77, { ...defaultDesign(77).spectrum, K: KMAX, M: MMAX });
    const f = radiusField(c, none, 11, 16);
    for (const [i, j] of [[0, 0], [3, 5], [10, 15], [7, 2]]) {
      expect(f.r[i * 16 + j]).toBeCloseTo(Math.max(R_MIN, naive(c, f.h[i], f.phi[j])), 9);
    }
  });

  it('twist rotates the angular pattern by 2*pi*twist*h', () => {
    const c = only([[0, 0, 1, 0], [0, 3, 0.2, 0]]);
    const twist = 0.25;
    const f = radiusField(c, { twist, edginess: 0 }, 3, 64);
    const i = 2; // h = 1
    const j = 10;
    const expected = 1 + 0.2 * Math.cos(3 * (f.phi[j] - 2 * Math.PI * twist));
    expect(f.r[i * 64 + j]).toBeCloseTo(expected, 12);
  });

  it('edginess keeps the mean radius and makes the section squarer', () => {
    const c = only([[0, 0, 1, 0]]);
    const f = radiusField(c, { twist: 0, edginess: 3 }, 2, 256);
    let mean = 0;
    for (let j = 0; j < 256; j++) mean += f.r[j] / 256;
    expect(mean).toBeCloseTo(1, 6);
    const atAxis = f.r[0]; // phi = 0
    const atCorner = f.r[32]; // phi = pi/4
    expect(atCorner).toBeGreaterThan(atAxis * 1.2);
  });

  it('clamps to R_MIN', () => {
    const f = radiusField(only([[0, 0, 1, 0], [0, 1, 5, 0]]), none, 2, 8);
    expect(Math.min(...f.r)).toBe(R_MIN);
  });
});
