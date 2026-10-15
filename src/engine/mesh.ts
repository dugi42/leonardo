import type { Design } from '../design/schema';
import { buildBody } from './body';
import { GRID, type Resolution } from './constants';
import { printScale, type PrintScale } from './fit';
import { coefficients } from './spectrum';
import { radiusField, type Field } from './surface';

/** Indexed triangle mesh in millimetres: xyz per vertex, three indices per face. */
export interface Mesh {
  positions: Float32Array;
  indices: Uint32Array;
}

export interface BuiltMesh {
  mesh: Mesh;
  field: Field;
  scale: PrintScale;
}

export function buildMesh(design: Design, res: Resolution): BuiltMesh {
  const { nh, nphi } = GRID[res];
  const field = radiusField(coefficients(design.seed, design.spectrum), design.modifiers, nh, nphi);
  const scale = printScale(field, design.print);
  return { mesh: buildBody(field, scale, design.body), field, scale };
}
