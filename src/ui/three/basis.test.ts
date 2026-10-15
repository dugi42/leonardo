import type { Mesh } from '../../engine/mesh';
import { basisTint } from './basis';

// Four vertices: bottom and top on the +x and -x side of a 100 mm tall object.
const mesh: Mesh = {
  positions: Float32Array.from([10, 0, 0, -10, 0, 0, 10, 0, 100, -10, 0, 100]),
  indices: new Uint32Array(),
};
const opts = { heightMm: 100, offset: [0, 0] as [number, number], twist: 0 };

describe('basisTint', () => {
  it('weights each vertex by cos(pi k h) cos(m phi - phase)', () => {
    const w = basisTint(mesh, { k: 1, m: 0, phase: 0 }, opts);
    expect(Array.from(w)).toEqual([1, 1, -1, -1].map((x) => expect.closeTo(x, 6)));
  });

  it('follows the angular phase', () => {
    const w = basisTint(mesh, { k: 0, m: 1, phase: 0 }, opts);
    expect(w[0]).toBeCloseTo(1, 6); // phi = 0
    expect(w[1]).toBeCloseTo(-1, 6); // phi = pi
    const shifted = basisTint(mesh, { k: 0, m: 1, phase: Math.PI }, opts);
    expect(shifted[0]).toBeCloseTo(-1, 6);
  });
});
