import { printScale } from './fit';
import { printerById, PRINTERS } from './printers';
import type { Field } from './surface';

function cylinder(radius: number, nphi = 64): Field {
  const phi = Float64Array.from({ length: nphi }, (_, j) => (2 * Math.PI * j) / nphi);
  return { nh: 2, nphi, h: Float64Array.from([0, 1]), phi, r: new Float64Array(2 * nphi).fill(radius), height: 2.5 };
}

describe('printers', () => {
  it('has unique ids and falls back to P1S', () => {
    expect(new Set(PRINTERS.map((p) => p.id)).size).toBe(PRINTERS.length);
    expect(printerById('nope').id).toBe('p1s');
    expect(printerById('a1mini').bed).toEqual([180, 180]);
  });
});

describe('printScale', () => {
  it('scales the unit cylinder to the requested height', () => {
    const s = printScale(cylinder(1), { printer: 'x1c', heightMm: 100 });
    expect(s.sigma).toBeCloseTo(40, 9);
    expect(s.heightMm).toBeCloseTo(100, 9);
    expect(s.capped).toBe(false);
  });

  it('caps the height at the printer build height', () => {
    const s = printScale(cylinder(1), { printer: 'a1mini', heightMm: 300 });
    expect(s.sigma).toBeCloseTo(72, 9);
    expect(s.heightMm).toBeCloseTo(180, 9);
    expect(s.capped).toBe(true);
  });

  it('shrinks wide designs to fit the bed minus margins', () => {
    const s = printScale(cylinder(4), { printer: 'a1mini', heightMm: 150 });
    // width 8 units must fit 160 mm -> sigma <= 20
    expect(s.sigma).toBeCloseTo(20, 6);
    expect(s.capped).toBe(true);
  });

  it('recentres an off-axis footprint', () => {
    const nphi = 64;
    const f = cylinder(1, nphi);
    // radius 2 on the +x side only shifts the bbox centre to +x
    for (let j = 0; j < nphi; j++) if (Math.cos(f.phi[j]) > 0.9) { f.r[j] = 2; f.r[nphi + j] = 2; }
    const s = printScale(f, { printer: 'x1c', heightMm: 100 });
    expect(s.offset[0]).toBeLessThan(0);
    expect(s.offset[1]).toBeCloseTo(0, 9);
  });
});
