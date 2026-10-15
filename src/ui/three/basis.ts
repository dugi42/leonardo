import type { Mesh } from '../../engine/mesh';

export interface BasisCell {
  k: number;
  m: number;
  /** atan2(S, C) of the cell, so the tint lines up with what the cell adds. */
  phase: number;
}

/**
 * Per-vertex weight in [-1, 1] of one spectrum cell's basis function
 * cos(pi k h) cos(m (phi - twist angle) - phase), read from vertex positions so it works
 * for every body (inner walls, floors and lips included).
 */
export function basisTint(
  mesh: Mesh,
  cell: BasisCell,
  opts: { heightMm: number; offset: [number, number]; twist: number },
): Float32Array {
  const p = mesh.positions;
  const out = new Float32Array(p.length / 3);
  for (let v = 0; v < out.length; v++) {
    const x = p[3 * v] - opts.offset[0];
    const y = p[3 * v + 1] - opts.offset[1];
    const h = Math.min(1, Math.max(0, p[3 * v + 2] / opts.heightMm));
    const phi = Math.atan2(y, x) - 2 * Math.PI * opts.twist * h;
    out[v] = Math.cos(Math.PI * cell.k * h) * Math.cos(cell.m * phi - cell.phase);
  }
  return out;
}
