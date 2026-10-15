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

/** Amplitude envelope; higher roughness = slower decay = more fine detail. */
function envelope(recipe: Recipe, k: number, m: number): number {
  const p = 2.5 - 1.7 * recipe.roughness;
  const base = m === 0 ? 0.35 * recipe.bulge : 0.25 * recipe.flutes;
  return base * (1 + k) ** -p * (1 + m) ** -p;
}

/**
 * The untruncated, unedited spectrum of a seed. Random unit values are always drawn for
 * the whole grid in row-major order, so recipe sliders rescale a design instead of
 * reshuffling it.
 */
export function fullCoefficients(seed: number, recipe: Recipe): Coefficients {
  const rng = sfc32(seed);
  const C = new Float64Array(KMAX * MMAX);
  const S = new Float64Array(KMAX * MMAX);
  const n = recipe.symmetry;
  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      const u = 2 * rng() - 1;
      const w = 2 * rng() - 1;
      if (k === 0 && m === 0) continue;
      if (m > 0 && n > 0 && m % n !== 0) continue;
      const a = envelope(recipe, k, m);
      C[idx(k, m)] = a * u;
      S[idx(k, m)] = m === 0 ? 0 : a * w;
    }
  }
  C[idx(0, 0)] = 1;
  C[idx(0, recipe.ribFrequency)] += 0.12 * recipe.ribs;
  return { C, S };
}

/** The spectrum actually used for the shape: edits applied, truncated to K x M. */
export function coefficients(seed: number, spectrum: Spectrum): Coefficients {
  const { C, S } = fullCoefficients(seed, spectrum.recipe);
  for (const [key, gain] of Object.entries(spectrum.edits)) {
    const [k, m] = key.split(',').map(Number);
    if (k === 0 && m === 0) continue;
    C[idx(k, m)] *= gain;
    S[idx(k, m)] *= gain;
  }
  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      if (k < spectrum.K && m < spectrum.M) continue;
      C[idx(k, m)] = 0;
      S[idx(k, m)] = 0;
    }
  }
  return { C, S };
}
