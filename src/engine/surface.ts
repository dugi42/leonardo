import type { Form, Modifiers } from '../design/schema';
import { KMAX, MMAX, R_MIN } from './constants';
import { archetypeProfile, footFactor, heightForProportion, rimFactor } from './profile';
import { idx, type Coefficients } from './spectrum';

/** Relative radius r(h, phi) on a grid: nh rings (h = 0..1 inclusive) x nphi angles. */
export interface Field {
  nh: number;
  nphi: number;
  h: Float64Array;
  phi: Float64Array;
  /** Row-major: ring i, angle j at i * nphi + j. */
  r: Float64Array;
  /** Raw height for h = 1 (max form radius is 1). */
  height: number;
}

/**
 * Largest log-radius excursion: detail is softly saturated with DETAIL_MAX * tanh(D / DETAIL_MAX),
 * so ridges peak at e^0.7 ~ 2x and valleys at 0.5x of the form instead of thin fins.
 */
export const DETAIL_MAX = 0.7;

/** Superellipse radius factor with exponent q; 1 for a circle. */
function superellipse(angle: number, q: number): number {
  return (Math.abs(Math.cos(angle)) ** q + Math.abs(Math.sin(angle)) ** q) ** (-1 / q);
}

const edgeMeans = new Map<number, number>();
function edgeMean(q: number): number {
  let mean = edgeMeans.get(q);
  if (mean === undefined) {
    const n = 1440;
    mean = 0;
    for (let j = 0; j < n; j++) mean += superellipse((2 * Math.PI * j) / n, q) / n;
    edgeMeans.set(q, mean);
  }
  return mean;
}

/**
 * r(h, phi) = form(h) * exp(D(h, phi)) with the inverse transform
 * D = sum_k sum_m (C cos m phi + S sin m phi) cos(pi k h), evaluated separably, then
 * twisted (phase shift growing with h) and given superellipse corners that turn with the
 * twist. `solidTop` selects the rounded-edge rim for closed tops.
 */
export function radiusField(
  c: Coefficients,
  shape: { modifiers: Modifiers; form: Form },
  nh: number,
  nphi: number,
  solidTop = true,
): Field {
  const mods = shape.modifiers;
  const form = shape.form;
  const h = new Float64Array(nh);
  const phi = new Float64Array(nphi);
  const r = new Float64Array(nh * nphi);
  for (let i = 0; i < nh; i++) h[i] = nh === 1 ? 0 : i / (nh - 1);
  for (let j = 0; j < nphi; j++) phi[j] = (2 * Math.PI * j) / nphi;

  // Only angular frequencies with any energy are summed.
  const active: number[] = [];
  for (let m = 0; m < MMAX; m++) {
    for (let k = 0; k < KMAX; k++) {
      if (c.C[idx(k, m)] !== 0 || c.S[idx(k, m)] !== 0) {
        active.push(m);
        break;
      }
    }
  }

  const q = 2 * (1 + mods.edginess);
  const edgeNorm = mods.edginess > 0 ? 1 / edgeMean(q) : 1;
  const P = new Float64Array(MMAX);
  const Q = new Float64Array(MMAX);
  const cosK = new Float64Array(KMAX);

  for (let i = 0; i < nh; i++) {
    const base =
      archetypeProfile(form.archetype, h[i]) * rimFactor(form.rim, h[i], solidTop) * footFactor(form.foot, h[i]);
    for (let k = 0; k < KMAX; k++) cosK[k] = Math.cos(Math.PI * k * h[i]);
    for (const m of active) {
      let p = 0;
      let s = 0;
      for (let k = 0; k < KMAX; k++) {
        p += c.C[idx(k, m)] * cosK[k];
        s += c.S[idx(k, m)] * cosK[k];
      }
      P[m] = p;
      Q[m] = s;
    }
    const tau = 2 * Math.PI * mods.twist * h[i];
    for (let j = 0; j < nphi; j++) {
      const a = phi[j] - tau;
      let d = 0;
      for (const m of active) d += P[m] * Math.cos(m * a) + Q[m] * Math.sin(m * a);
      let v = base * Math.exp(DETAIL_MAX * Math.tanh(d / DETAIL_MAX));
      if (mods.edginess > 0) v *= superellipse(a, q) * edgeNorm;
      r[i * nphi + j] = Math.max(R_MIN, v);
    }
  }
  return { nh, nphi, h, phi, r, height: heightForProportion(form.proportion) };
}
