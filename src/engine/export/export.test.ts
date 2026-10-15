import { strFromU8, unzipSync } from 'fflate';
import { defaultDesign } from '../../design/schema';
import { buildMesh } from '../mesh';
import { fileName, toStl } from './stl';
import { to3mf } from './threemf';

const { mesh } = buildMesh({ ...defaultDesign(4), spectrum: { ...defaultDesign(4).spectrum, K: 1, M: 1 } }, 'preview');
const nFaces = mesh.indices.length / 3;
const nVerts = mesh.positions.length / 3;

describe('toStl', () => {
  const bytes = toStl(mesh, 'test');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  it('has the binary STL size and face count', () => {
    expect(bytes.byteLength).toBe(84 + 50 * nFaces);
    expect(view.getUint32(80, true)).toBe(nFaces);
  });

  it('stores the triangles with outward normals', () => {
    // first face lies on the side wall at phi = 0, so its normal points to +x
    expect(view.getFloat32(84, true)).toBeGreaterThan(0.9);
    const v0x = view.getFloat32(84 + 12, true);
    expect(v0x).toBeCloseTo(mesh.positions[3 * mesh.indices[0]], 5);
  });
});

describe('to3mf', () => {
  const files = unzipSync(to3mf(mesh, { title: 'Leonardo 4', description: 'hint' }));

  it('contains the required package parts', () => {
    expect(Object.keys(files).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
  });

  it('describes the mesh in millimetres', () => {
    const xml = strFromU8(files['3D/3dmodel.model']);
    expect(xml).toContain('unit="millimeter"');
    expect(xml.match(/<vertex /g)!.length).toBe(nVerts);
    expect(xml.match(/<triangle /g)!.length).toBe(nFaces);
    expect(xml).toContain('<metadata name="Title">Leonardo 4</metadata>');
  });

  it('escapes metadata', () => {
    const xml = strFromU8(unzipSync(to3mf(mesh, { title: 'a<b&c', description: '' }))['3D/3dmodel.model']);
    expect(xml).toContain('a&lt;b&amp;c');
  });
});

describe('fileName', () => {
  it('names files by seed and body', () => {
    expect(fileName(defaultDesign(42), 'stl')).toBe('leonardo-42-solid.stl');
  });
});
