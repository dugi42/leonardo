import { unzipSync } from 'fflate';
import { defaultDesign } from '../design/schema';
import { exportFile } from './exportFile';

describe('exportFile', () => {
  const d = { ...defaultDesign(8), spectrum: { ...defaultDesign(8).spectrum, K: 1, M: 1 } };

  it('builds an STL at export resolution', () => {
    const f = exportFile(d, 'stl');
    expect(f.name).toBe('leonardo-8-solid.stl');
    expect(f.mime).toBe('model/stl');
    const faces = new DataView(f.bytes.buffer).getUint32(80, true);
    expect(faces).toBe(2 * 384 * 255 + 2 * 384);
  });

  it('builds a 3MF with a spiral vase hint for vase bodies', () => {
    const f = exportFile({ ...d, body: { ...d.body, kind: 'vase' } }, '3mf');
    expect(f.name).toBe('leonardo-8-vase.3mf');
    const model = new TextDecoder().decode(unzipSync(f.bytes)['3D/3dmodel.model']);
    expect(model).toMatch(/Spiral vase/i);
  });
});
