import { intBetween, sfc32, uniform, type Rng } from '../engine/prng';
import { ARCHETYPE_IDS, ARCHETYPES, RIMS } from '../engine/profile';
import { defaultDesign, normaliseDesign, RANGES, type Design } from './schema';

/** A fresh shape for a seed. Body and print settings come from `base` so a user's setup sticks. */
export function randomDesign(seed: number, base: Design = defaultDesign(seed)): Design {
  // Different stream from the spectrum's own draws, which also start from this seed.
  const rng = sfc32((seed ^ 0x5bd1e995) >>> 0);
  const chance = (p: number) => rng() < p;
  const archetype = ARCHETYPE_IDS[intBetween(rng, 0, ARCHETYPE_IDS.length - 1)];
  const rimDraw = rng();
  const design: Design = {
    v: 2,
    seed,
    form: {
      archetype,
      proportion: ARCHETYPES[archetype].proportion + uniform(rng, -0.12, 0.12),
      rim: rimDraw < 0.5 ? 'flat' : rimDraw < 0.8 ? 'round' : 'flare',
      foot: chance(0.3) ? uniform(rng, 0.3, 1) : 0,
    },
    spectrum: {
      K: intBetween(rng, 3, 14),
      M: intBetween(rng, 3, 24),
      recipe: {
        bulge: uniform(rng, 0.2, 1),
        flutes: uniform(rng, 0, 0.8),
        roughness: uniform(rng, 0.1, 0.8),
        symmetry: chance(0.7) ? intBetween(rng, 3, 10) : 0,
        ribs: chance(0.25) ? uniform(rng, 0.2, 1) : 0,
        ribFrequency: intBetween(rng, 6, 24),
      },
      edits: {},
    },
    modifiers: {
      twist: chance(0.5) ? uniform(rng, -0.75, 0.75) : 0,
      edginess: chance(0.4) ? uniform(rng, 0, 3) : 0,
    },
    body: base.body,
    print: base.print,
  };
  // Symmetric designs need at least two flute harmonics inside the kept rectangle.
  const n = design.spectrum.recipe.symmetry;
  if (n > 0) design.spectrum.M = Math.max(design.spectrum.M, 2 * n + 1);
  return normaliseDesign(design)!;
}

function gaussian(rng: Rng): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A nearby design: every shape parameter jitters by a temperature-scaled step. */
export function variation(parent: Design, temperature: number, rng: Rng): Design {
  const jitter = (value: number, key: keyof typeof RANGES) => {
    const [lo, hi] = RANGES[key];
    return value + temperature * (hi - lo) * 0.25 * gaussian(rng);
  };
  const { spectrum: sp, modifiers: mo } = parent;
  const r = sp.recipe;
  const reseed = rng() < temperature * 0.5;
  const fo = parent.form;
  const child = {
    ...parent,
    seed: reseed ? Math.floor(rng() * 4294967296) : parent.seed,
    form: {
      ...fo,
      proportion: jitter(fo.proportion, 'proportion'),
      foot: fo.foot > 0 || rng() < temperature * 0.2 ? jitter(fo.foot, 'foot') : 0,
      rim: rng() < temperature * 0.2 ? RIMS[intBetween(rng, 0, RIMS.length - 1)] : fo.rim,
    },
    spectrum: {
      ...sp,
      K: jitter(sp.K, 'K'),
      M: jitter(sp.M, 'M'),
      recipe: {
        bulge: jitter(r.bulge, 'bulge'),
        flutes: jitter(r.flutes, 'flutes'),
        roughness: jitter(r.roughness, 'roughness'),
        symmetry: rng() < temperature * 0.3 ? intBetween(rng, 0, 8) : r.symmetry,
        ribs: jitter(r.ribs, 'ribs'),
        ribFrequency: jitter(r.ribFrequency, 'ribFrequency'),
      },
    },
    modifiers: { twist: jitter(mo.twist, 'twist'), edginess: jitter(mo.edginess, 'edginess') },
  };
  return normaliseDesign(child)!;
}
