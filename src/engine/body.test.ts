import { defaultDesign } from '../design/schema';
import { buildMesh } from './mesh';
import { checkMesh } from './validate';
import { cylinderDesign } from './testing';

function bounds(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[i + a]);
      hi[a] = Math.max(hi[a], p[i + a]);
    }
  return { lo, hi };
}

const polygonArea = (n: number, r: number) => 0.5 * n * Math.sin((2 * Math.PI) / n) * r * r;

describe('solid body', () => {
  it('is a closed cylinder of the analytic volume', () => {
    const { mesh, field } = buildMesh(cylinderDesign(), 'preview');
    const res = checkMesh(mesh);
    expect(res.ok).toBe(true);
    // unit radius -> 40 mm at 100 mm height (sigma = 100 / 2.5)
    expect(res.volume / (polygonArea(field.nphi, 40) * 100)).toBeCloseTo(1, 4);
  });

  it('stands on z = 0 with the requested height, centred on the origin', () => {
    const { mesh } = buildMesh(cylinderDesign(), 'preview');
    const { lo, hi } = bounds(mesh.positions);
    expect(lo[2]).toBeCloseTo(0, 6);
    expect(hi[2]).toBeCloseTo(100, 4);
    expect(lo[0] + hi[0]).toBeCloseTo(0, 4);
    expect(lo[1] + hi[1]).toBeCloseTo(0, 4);
  });

  it('is closed for a detailed random design', () => {
    const d = defaultDesign(99);
    const built = buildMesh({ ...d, modifiers: { twist: 1.3, edginess: 2 } }, 'preview');
    expect(checkMesh(built.mesh).ok).toBe(true);
  });

  it('builds vase identical to solid', () => {
    const a = buildMesh(cylinderDesign({ kind: 'solid' }), 'preview').mesh;
    const b = buildMesh(cylinderDesign({ kind: 'vase' }), 'preview').mesh;
    expect(b.indices).toEqual(a.indices);
    expect(b.positions).toEqual(a.positions);
  });
});

describe('hollow body', () => {
  it('is closed with the analytic shell volume', () => {
    const { mesh, field } = buildMesh(cylinderDesign({ kind: 'hollow', wallMm: 2, floorMm: 2 }), 'preview');
    const res = checkMesh(mesh);
    expect(res.ok).toBe(true);
    const n = field.nphi;
    const expected = polygonArea(n, 40) * 100 - polygonArea(n, 38) * 98;
    expect(res.volume / expected).toBeCloseTo(1, 3);
  });

  it('is closed for a detailed random design', () => {
    const d = defaultDesign(42);
    const built = buildMesh({ ...d, modifiers: { twist: -0.8, edginess: 1.5 }, body: { ...d.body, kind: 'hollow' } }, 'preview');
    expect(checkMesh(built.mesh).ok).toBe(true);
  });
});

describe('planter body', () => {
  it('is a hollow body minus the drainage hole through the floor', () => {
    const { mesh, field } = buildMesh(cylinderDesign({ kind: 'planter', wallMm: 2, floorMm: 2, holeMm: 8 }), 'preview');
    const res = checkMesh(mesh);
    expect(res.ok).toBe(true);
    const n = field.nphi;
    const expected = polygonArea(n, 40) * 100 - polygonArea(n, 38) * 98 - polygonArea(n, 4) * 2;
    expect(res.volume / expected).toBeCloseTo(1, 3);
  });

  it('falls back to a closed floor when the hole is zero', () => {
    const planter = buildMesh(cylinderDesign({ kind: 'planter', holeMm: 0 }), 'preview').mesh;
    const hollow = buildMesh(cylinderDesign({ kind: 'hollow' }), 'preview').mesh;
    expect(planter.indices.length).toBe(hollow.indices.length);
  });

  it('shrinks a hole that would cut the wall', () => {
    const built = buildMesh(cylinderDesign({ kind: 'planter', holeMm: 40 }), 'preview');
    expect(checkMesh(built.mesh).ok).toBe(true);
  });
});
