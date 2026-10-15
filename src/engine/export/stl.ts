import type { Design } from '../../design/schema';
import type { Mesh } from '../mesh';

export function fileName(design: Design, ext: 'stl' | '3mf'): string {
  return `leonardo-${design.seed}-${design.body.kind}.${ext}`;
}

/** Binary little-endian STL with per-face normals. */
export function toStl(mesh: Mesh, name: string): Uint8Array {
  const p = mesh.positions;
  const f = mesh.indices;
  const n = f.length / 3;
  const bytes = new Uint8Array(84 + 50 * n);
  const view = new DataView(bytes.buffer);
  const header = `leonardo ${name}`.slice(0, 80);
  for (let i = 0; i < header.length; i++) bytes[i] = header.charCodeAt(i) & 0x7f;
  view.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < f.length; t += 3) {
    const a = 3 * f[t];
    const b = 3 * f[t + 1];
    const c = 3 * f[t + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    o += 12;
    for (const v of [a, b, c]) {
      view.setFloat32(o, p[v], true);
      view.setFloat32(o + 4, p[v + 1], true);
      view.setFloat32(o + 8, p[v + 2], true);
      o += 12;
    }
    o += 2; // attribute byte count
  }
  return bytes;
}
