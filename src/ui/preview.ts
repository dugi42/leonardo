import type { Design } from '../design/schema';
import { buildMesh, type BuiltMesh } from '../engine/mesh';
import { meshStats, type MeshStats } from '../engine/stats';
import { checkMesh, type MeshCheck } from '../engine/validate';

export interface Preview extends BuiltMesh {
  stats: MeshStats;
  check: MeshCheck;
}

// Store designs are immutable, so object identity is a safe cache key shared by all views.
const cache = new WeakMap<Design, Preview>();

export function getPreview(design: Design): Preview {
  let p = cache.get(design);
  if (!p) {
    const built = buildMesh(design, 'preview');
    p = { ...built, stats: meshStats(built.mesh, design.body.kind), check: checkMesh(built.mesh) };
    cache.set(design, p);
  }
  return p;
}
