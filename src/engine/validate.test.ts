import type { Mesh } from './mesh';
import { checkMesh, signedVolume } from './validate';

function tetra(faces: number[][]): Mesh {
  return {
    positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    indices: Uint32Array.from(faces.flat()),
  };
}
const good = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];

describe('checkMesh', () => {
  it('accepts a closed outward tetrahedron with volume 1/6', () => {
    const res = checkMesh(tetra(good));
    expect(res).toEqual({ ok: true, volume: expect.closeTo(1 / 6, 9) });
  });

  it('reports a hole', () => {
    expect(checkMesh(tetra(good.slice(1)))).toMatchObject({ ok: false, reason: 'not closed' });
  });

  it('reports one flipped face', () => {
    const faces = [[0, 1, 2], ...good.slice(1)];
    expect(checkMesh(tetra(faces))).toMatchObject({ ok: false, reason: 'inconsistent orientation' });
  });

  it('reports inside-out meshes', () => {
    const faces = good.map(([a, b, c]) => [a, c, b]);
    expect(checkMesh(tetra(faces))).toMatchObject({ ok: false, reason: 'negative volume' });
    expect(signedVolume(tetra(faces))).toBeCloseTo(-1 / 6, 9);
  });

  it('reports non-finite coordinates', () => {
    const m = tetra(good);
    m.positions[4] = Number.NaN;
    expect(checkMesh(m)).toMatchObject({ ok: false, reason: 'non-finite vertices' });
  });
});
