import { BufferAttribute, BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Mesh } from '../../engine/mesh';

/** Smooth shading on the walls, crisp edges at rims and floors. */
export function meshToGeometry(mesh: Mesh, vertexColors?: Float32Array): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  if (vertexColors) g.setAttribute('color', new BufferAttribute(vertexColors, 3));
  g.setIndex(new BufferAttribute(mesh.indices, 1));
  const creased = toCreasedNormals(g, Math.PI / 3);
  g.dispose();
  creased.computeBoundingBox();
  creased.computeBoundingSphere();
  return creased;
}

export const SURFACE = {
  color: '#cfd3da',
  roughness: 0.42,
  metalness: 0,
  clearcoat: 0.35,
  clearcoatRoughness: 0.35,
} as const;
