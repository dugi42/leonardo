import type { Mesh } from './mesh';

export interface MeshCheck {
  ok: boolean;
  reason?: 'non-finite vertices' | 'not closed' | 'inconsistent orientation' | 'negative volume';
  volume: number;
}

/** Signed volume via the divergence theorem (sum of origin tetrahedra). */
export function signedVolume(mesh: Mesh): number {
  const p = mesh.positions;
  const f = mesh.indices;
  let v = 0;
  for (let t = 0; t < f.length; t += 3) {
    const a = 3 * f[t];
    const b = 3 * f[t + 1];
    const c = 3 * f[t + 2];
    v +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}

/**
 * Closed, consistently oriented 2-manifold with positive volume: every undirected edge
 * belongs to exactly two faces, which traverse it in opposite directions.
 */
export function checkMesh(mesh: Mesh): MeshCheck {
  for (const x of mesh.positions) if (!Number.isFinite(x)) return { ok: false, reason: 'non-finite vertices', volume: 0 };
  const n = mesh.positions.length / 3;
  const directed = new Map<number, number>();
  const f = mesh.indices;
  for (let t = 0; t < f.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const key = f[t + e] * n + f[t + ((e + 1) % 3)];
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  let flipped = false;
  for (const [key, count] of directed) {
    const a = Math.floor(key / n);
    const b = key % n;
    const back = directed.get(b * n + a) ?? 0;
    if (count + back !== 2) return { ok: false, reason: 'not closed', volume: 0 };
    if (count !== 1) flipped = true;
  }
  if (flipped) return { ok: false, reason: 'inconsistent orientation', volume: 0 };
  const volume = signedVolume(mesh);
  if (!(volume > 0)) return { ok: false, reason: 'negative volume', volume };
  return { ok: true, volume };
}
