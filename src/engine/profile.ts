/** Base silhouettes: relative radius over relative height, max 1. */
export const ARCHETYPES = {
  cylinder: { points: [[0, 1], [1, 1]], proportion: 0.45 },
  tumbler: { points: [[0, 0.8], [1, 1]], proportion: 0.5 },
  vase: { points: [[0, 0.55], [0.12, 0.62], [0.42, 1], [0.76, 0.6], [0.9, 0.5], [1, 0.58]], proportion: 0.25 },
  bottle: { points: [[0, 0.9], [0.5, 1], [0.66, 0.78], [0.78, 0.38], [1, 0.34]], proportion: 0.2 },
  bowl: { points: [[0, 0.5], [0.3, 0.8], [0.7, 0.97], [1, 1]], proportion: 0.9 },
  lantern: { points: [[0, 0.62], [0.5, 1], [1, 0.62]], proportion: 0.4 },
  amphora: { points: [[0, 0.38], [0.1, 0.46], [0.45, 1], [0.75, 0.7], [0.88, 0.44], [1, 0.52]], proportion: 0.3 },
} as const satisfies Record<string, { points: readonly (readonly [number, number])[]; proportion: number }>;

export type ArchetypeId = keyof typeof ARCHETYPES;
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export type Rim = 'flat' | 'round' | 'flare';
export const RIMS: readonly Rim[] = ['flat', 'round', 'flare'];

/** Fritsch-Carlson tangents: the interpolant never overshoots its control points. */
function tangents(pts: readonly (readonly [number, number])[]): number[] {
  const n = pts.length;
  const d: number[] = [];
  for (let i = 0; i + 1 < n; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const t: number[] = new Array(n).fill(0);
  t[0] = d[0];
  t[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / d[i];
    const b = t[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * d[i];
      t[i + 1] = k * b * d[i];
    }
  }
  return t;
}

const tangentCache = new Map<ArchetypeId, number[]>();

export function archetypeProfile(id: ArchetypeId, h: number): number {
  const pts = ARCHETYPES[id].points;
  if (pts.length === 2 && pts[0][1] === pts[1][1]) return pts[0][1];
  let t = tangentCache.get(id);
  if (!t) tangentCache.set(id, (t = tangents(pts)));
  const x = Math.min(1, Math.max(0, h));
  let i = 0;
  while (i < pts.length - 2 && x > pts[i + 1][0]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const w = x1 - x0;
  const s = (x - x0) / w;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * w * t[i] + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * w * t[i + 1]
  );
}

/** Raw height of the design for proportion 0 (slender) .. 1 (squat); max radius is 1. */
export function heightForProportion(p: number): number {
  return 4.4 - 3.4 * p;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Radius factor for the rim. `solidTop` is true for bodies with a closed top (solid,
 * vase): their round rim is a rounded edge. Vessels get a real half-round lip instead.
 */
export function rimFactor(rim: Rim, h: number, solidTop: boolean): number {
  if (rim === 'flare') return 1 + 0.14 * smoothstep(0.86, 1, h);
  if (rim === 'round' && solidTop && h > 0.95) {
    const t = (h - 0.95) / 0.05;
    return 1 - 0.12 * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  }
  return 1;
}

/** Pedestal: narrows the base by up to 30 % and flares back into the body. */
export function footFactor(foot: number, h: number): number {
  if (foot <= 0) return 1;
  const length = 0.05 + 0.1 * foot;
  return 1 - 0.3 * foot * (1 - smoothstep(0, length, h));
}
