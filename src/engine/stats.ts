import type { BodyKind } from '../design/schema';
import type { Mesh } from './mesh';
import { signedVolume } from './validate';

/** g/mm³ */
export const PLA_DENSITY = 1.24e-3;
const SIN45 = Math.SQRT1_2;
const SIN30 = 0.5;
/** Faces this close to the bed rest on it and are never overhangs. */
const BED_EPS_MM = 0.01;

export interface MeshStats {
  size: [number, number, number];
  volumeMm3: number;
  areaMm2: number;
  overhangAreaMm2: number;
  grams: number;
}

/** Visits every face with its area and the z component of its unit outward normal. */
function eachFace(mesh: Mesh, fn: (t: number, area: number, nz: number, onBed: boolean) => void) {
  const p = mesh.positions;
  const f = mesh.indices;
  for (let t = 0; t < f.length; t += 3) {
    const a = 3 * f[t];
    const b = 3 * f[t + 1];
    const c = 3 * f[t + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;
    const onBed = p[a + 2] < BED_EPS_MM && p[b + 2] < BED_EPS_MM && p[c + 2] < BED_EPS_MM;
    fn(t, len / 2, nz / len, onBed);
  }
}

export function meshStats(mesh: Mesh, kind: BodyKind): MeshStats {
  const p = mesh.positions;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[i + a]);
      hi[a] = Math.max(hi[a], p[i + a]);
    }
  }
  let area = 0;
  let overhang = 0;
  eachFace(mesh, (_, a, nz, onBed) => {
    area += a;
    if (!onBed && nz < -SIN45) overhang += a;
  });
  const volume = signedVolume(mesh);
  let printed: number;
  if (kind === 'hollow' || kind === 'planter') printed = volume;
  else if (kind === 'vase') printed = Math.min(volume, area * 0.45);
  else {
    // Default slicer profile: about 0.8 mm of walls/skins plus 15 % infill inside.
    const shell = Math.min(volume, area * 0.8);
    printed = shell + (volume - shell) * 0.15;
  }
  return {
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    volumeMm3: volume,
    areaMm2: area,
    overhangAreaMm2: overhang,
    grams: printed * PLA_DENSITY,
  };
}

/** Per-vertex overhang severity: 0 up to 30° past vertical, rising to 1 at 45° and beyond. */
export function faceOverhang(mesh: Mesh): Float32Array {
  const marks = new Float32Array(mesh.positions.length / 3);
  const f = mesh.indices;
  eachFace(mesh, (t, _, nz, onBed) => {
    if (onBed || nz >= -SIN30) return;
    const v = Math.min(1, (-nz - SIN30) / (SIN45 - SIN30));
    for (let e = 0; e < 3; e++) marks[f[t + e]] = Math.max(marks[f[t + e]], v);
  });
  return marks;
}
