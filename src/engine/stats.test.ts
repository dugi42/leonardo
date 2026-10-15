import { defaultDesign, type Body } from '../design/schema';
import { buildBody } from './body';
import type { PrintScale } from './fit';
import { buildMesh } from './mesh';
import { CYLINDER_25 } from './testing';
import { faceOverhang, meshStats, PLA_DENSITY } from './stats';
import type { Field } from './surface';

const solidBody: Body = { kind: 'solid', wallMm: 2, floorMm: 2, holeMm: 0 };

function coneField(r0: number, r1: number, nh = 20, nphi = 64): Field {
  const h = Float64Array.from({ length: nh }, (_, i) => i / (nh - 1));
  const phi = Float64Array.from({ length: nphi }, (_, j) => (2 * Math.PI * j) / nphi);
  const r = new Float64Array(nh * nphi);
  for (let i = 0; i < nh; i++) r.fill(r0 + (r1 - r0) * h[i], i * nphi, (i + 1) * nphi);
  return { nh, nphi, h, phi, r, height: 2.5 };
}
const scale: PrintScale = { sigma: 10, heightMm: 25, capped: false, offset: [0, 0] };

describe('meshStats', () => {
  const d = defaultDesign(3);
  const cyl = { ...d, form: CYLINDER_25, spectrum: { ...d.spectrum, K: 1, M: 1 }, print: { printer: 'x1c' as const, heightMm: 100 } };

  it('measures size and volume of the cylinder', () => {
    const s = meshStats(buildMesh(cyl, 'preview').mesh, 'solid');
    expect(s.size[0]).toBeCloseTo(80, 1);
    expect(s.size[2]).toBeCloseTo(100, 4);
    expect(s.volumeMm3 / (Math.PI * 40 * 40 * 100)).toBeCloseTo(1, 2);
    expect(s.areaMm2 / (2 * Math.PI * 40 * 100 + 2 * Math.PI * 40 * 40)).toBeCloseTo(1, 2);
  });

  it('estimates grams from walls and infill for solids and full volume for vessels', () => {
    const solid = meshStats(buildMesh(cyl, 'preview').mesh, 'solid');
    const shell = solid.areaMm2 * 0.8;
    expect(solid.grams).toBeCloseTo((shell + (solid.volumeMm3 - shell) * 0.15) * PLA_DENSITY, 6);
    const hollow = meshStats(buildMesh({ ...cyl, body: { ...cyl.body, kind: 'hollow' } }, 'preview').mesh, 'hollow');
    expect(hollow.grams).toBeCloseTo(hollow.volumeMm3 * PLA_DENSITY, 6);
  });

  it('finds no overhang on an upright cylinder', () => {
    expect(meshStats(buildMesh(cyl, 'preview').mesh, 'solid').overhangAreaMm2).toBe(0);
  });

  it('finds overhang on a cone that widens steeply', () => {
    const widening = buildBody(coneField(0.2, 4.2), scale, solidBody);
    const narrowing = buildBody(coneField(4.2, 0.2), scale, solidBody);
    expect(meshStats(widening, 'solid').overhangAreaMm2).toBeGreaterThan(1000);
    expect(meshStats(narrowing, 'solid').overhangAreaMm2).toBe(0);
  });
});

describe('faceOverhang', () => {
  it('marks vertices of overhanging faces only', () => {
    const widening = buildBody(coneField(0.2, 4.2), scale, solidBody);
    const marks = faceOverhang(widening);
    expect(marks.length).toBe(widening.positions.length / 3);
    expect(Math.max(...marks)).toBe(1);
    const upright = buildBody(coneField(4.2, 0.2), scale, solidBody);
    expect(Math.max(...faceOverhang(upright))).toBe(0);
  });
});
