import type { Body } from '../design/schema';
import { H0 } from './constants';
import type { PrintScale } from './fit';
import type { Mesh } from './mesh';
import type { Field } from './surface';

/**
 * Index-stitched mesh builder. Rings are CCW seen from +z and all share the field's phi
 * samples, so any two rings can be joined quad by quad. Faces wind outward.
 */
class Builder {
  private pos: number[] = [];
  private idx: number[] = [];

  constructor(
    private field: Field,
    private scale: PrintScale,
  ) {}

  /** Adds a ring at height zMm with radius (mm) per phi sample; returns its first index. */
  ring(zMm: number, radiusMm: (j: number) => number): number {
    const start = this.pos.length / 3;
    const [ox, oy] = this.scale.offset;
    for (let j = 0; j < this.field.nphi; j++) {
      const phi = this.field.phi[j];
      const r = radiusMm(j);
      this.pos.push(ox + r * Math.cos(phi), oy + r * Math.sin(phi), zMm);
    }
    return start;
  }

  point(zMm: number): number {
    const start = this.pos.length / 3;
    this.pos.push(this.scale.offset[0], this.scale.offset[1], zMm);
    return start;
  }

  private quads(fn: (j: number, j1: number) => void) {
    const n = this.field.nphi;
    for (let j = 0; j < n; j++) fn(j, (j + 1) % n);
  }

  /** Side wall facing away from the axis, between lower ring a and upper ring b. */
  outer(a: number, b: number) {
    this.quads((j, j1) => this.idx.push(a + j, a + j1, b + j1, a + j, b + j1, b + j));
  }

  /** Side wall facing the axis. */
  inner(a: number, b: number) {
    this.quads((j, j1) => this.idx.push(a + j, b + j1, a + j1, a + j, b + j, b + j1));
  }

  capDown(ring: number, centre: number) {
    this.quads((j, j1) => this.idx.push(centre, ring + j1, ring + j));
  }

  capUp(ring: number, centre: number) {
    this.quads((j, j1) => this.idx.push(centre, ring + j, ring + j1));
  }

  /** Flat ring between an inner and an outer ring, facing +z. */
  annulusUp(innerRing: number, outerRing: number) {
    const i = innerRing;
    const o = outerRing;
    this.quads((j, j1) => this.idx.push(i + j, o + j, o + j1, i + j, o + j1, i + j1));
  }

  /** Flat ring between an inner and an outer ring, facing -z. */
  annulusDown(innerRing: number, outerRing: number) {
    const i = innerRing;
    const o = outerRing;
    this.quads((j, j1) => this.idx.push(i + j, o + j1, o + j, i + j, i + j1, o + j1));
  }

  mesh(): Mesh {
    return { positions: Float32Array.from(this.pos), indices: Uint32Array.from(this.idx) };
  }
}

function outerRings(b: Builder, field: Field, scale: PrintScale): number[] {
  const rings: number[] = [];
  for (let i = 0; i < field.nh; i++) {
    const z = field.h[i] * H0 * scale.sigma;
    rings.push(b.ring(z, (j) => field.r[i * field.nphi + j] * scale.sigma));
  }
  for (let i = 0; i + 1 < rings.length; i++) b.outer(rings[i], rings[i + 1]);
  return rings;
}

function solid(field: Field, scale: PrintScale): Mesh {
  const b = new Builder(field, scale);
  const rings = outerRings(b, field, scale);
  b.capDown(rings[0], b.point(0));
  b.capUp(rings[rings.length - 1], b.point(scale.heightMm));
  return b.mesh();
}

export function buildBody(field: Field, scale: PrintScale, body: Body): Mesh {
  switch (body.kind) {
    case 'solid':
    case 'vase':
      return solid(field, scale);
    default:
      throw new Error(`body ${body.kind} not implemented`);
  }
}
