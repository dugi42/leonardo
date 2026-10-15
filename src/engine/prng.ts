/** Uniform random number in [0, 1). */
export type Rng = () => number;

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** sfc32: small, fast, and identical in every JS engine, so seeds reproduce designs. */
export function sfc32(seed: number): Rng {
  const init = splitmix32(seed);
  let a = init();
  let b = init();
  let c = init();
  let d = init();
  const next = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

export function uniform(rng: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

export function intBetween(rng: Rng, lo: number, hiInclusive: number): number {
  return lo + Math.floor(rng() * (hiInclusive - lo + 1));
}

/** Fresh uint32 seed for a new design (UI only; designs themselves never use Math.random). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
