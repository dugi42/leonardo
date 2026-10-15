import type { Recipe, Spectrum } from '../design/schema';
import { KMAX, MMAX } from './constants';
import { sfc32 } from './prng';

/** Row-major coefficient grid: index k * MMAX + m. */
export interface Coefficients {
  C: Float64Array;
  S: Float64Array;
}

export const idx = (k: number, m: number) => k * MMAX + m;

export function magnitude(c: Coefficients, k: number, m: number): number {
  const i = idx(k, m);
  return Math.hypot(c.C[i], c.S[i]);
}

/**
 * Envelope shape before normalisation; higher roughness = slower decay = more fine detail.
 * Angular terms decay gently in m so symmetric flutes (m = 5, 6, ...) stay visible;
 * m = 1 only leans the body, so it is muted.
 */
function weight(q: number, k: number, m: number): number {
  if (m === 0) return k === 0 ? 0 : k ** -q;
  return (m === 1 ? 0.15 : 1) * (1 + k) ** -q * m ** (-q / 3);
}

/** RMS envelope of the profile (m = 0) and angular (m > 0) blocks at full slider value. */
const PROFILE_RMS = 0.3;
const ANGULAR_RMS = 0.5;

/**
 * The untruncated, unedited spectrum of a seed: the Fourier transform of the log radius
 * on top of the form, so C_00 is always 0. Random unit values are always drawn for
 * the whole grid in row-major order, so recipe sliders rescale a design instead of
 * reshuffling it. Each block's envelope is normalised to a fixed energy, so symmetry
 * and roughness change the character of a shape, not its overall strength.
 */
export function fullCoefficients(seed: number, recipe: Recipe): Coefficients {
  const rng = sfc32(seed);
  const C = new Float64Array(KMAX * MMAX);
  const S = new Float64Array(KMAX * MMAX);
  const n = recipe.symmetry;
  const q = 2 - 1.2 * recipe.roughness;
  const allowed = (m: number) => m === 0 || n === 0 || m % n === 0;

  let profileEnergy = 0;
  let angularEnergy = 0;
  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      if (!allowed(m)) continue;
      const w2 = weight(q, k, m) ** 2;
      if (m === 0) profileEnergy += w2;
      else angularEnergy += w2;
    }
  }
  const profileScale = (PROFILE_RMS * recipe.bulge) / Math.sqrt(profileEnergy);
  const angularScale = angularEnergy > 0 ? (ANGULAR_RMS * recipe.flutes) / Math.sqrt(angularEnergy) : 0;

  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      const u = 2 * rng() - 1;
      const w = 2 * rng() - 1;
      if ((k === 0 && m === 0) || !allowed(m)) continue;
      const a = weight(q, k, m) * (m === 0 ? profileScale : angularScale);
      C[idx(k, m)] = a * u;
      S[idx(k, m)] = m === 0 ? 0 : a * w;
    }
  }
  C[idx(0, recipe.ribFrequency)] += 0.12 * recipe.ribs;
  return { C, S };
}

/** Below this magnitude a cell counts as empty; boosting it injects energy instead. */
const EMPTY = 0.01;
const INJECT = 0.05;

/** Edits applied, not truncated: what the spectrum editor shows. */
export function editedCoefficients(seed: number, spectrum: Spectrum): Coefficients {
  const { C, S } = fullCoefficients(seed, spectrum.recipe);
  for (const [key, gain] of Object.entries(spectrum.edits)) {
    const [k, m] = key.split(',').map(Number);
    if (k === 0 && m === 0) continue;
    const i = idx(k, m);
    if (Math.hypot(C[i], S[i]) < EMPTY) C[i] += INJECT * Math.max(0, gain - 1);
    else {
      C[i] *= gain;
      S[i] *= gain;
    }
  }
  return { C, S };
}

/** The spectrum actually used for the shape: edits applied, truncated to K x M. */
export function coefficients(seed: number, spectrum: Spectrum): Coefficients {
  const { C, S } = editedCoefficients(seed, spectrum);
  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      if (k < spectrum.K && m < spectrum.M) continue;
      C[idx(k, m)] = 0;
      S[idx(k, m)] = 0;
    }
  }
  return { C, S };
}
