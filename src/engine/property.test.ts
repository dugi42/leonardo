import { randomDesign } from '../design/mutate';
import { BODY_KINDS, defaultDesign, type Design } from '../design/schema';
import { sfc32 } from './prng';
import { BED_MARGIN_MM } from './constants';
import { buildMesh } from './mesh';
import { printerById, PRINTERS } from './printers';
import { checkMesh } from './validate';

function designs(): Design[] {
  const rng = sfc32(2026);
  return Array.from({ length: 100 }, (_, i) => {
    const base = defaultDesign(0);
    const printer = PRINTERS[i % PRINTERS.length].id;
    const d = randomDesign(Math.floor(rng() * 2 ** 32), {
      ...base,
      body: { kind: BODY_KINDS[i % 4], wallMm: 0.8 + rng() * 4, floorMm: 0.8 + rng() * 4, holeMm: rng() * 30 },
      print: { printer, heightMm: 40 + rng() * 300 },
    });
    // Push some designs to the extremes of the modifiers.
    if (i % 5 === 0) d.modifiers = { twist: 2 * (rng() * 2 - 1), edginess: 5 * rng() };
    if (i % 7 === 0) d.spectrum = { ...d.spectrum, K: 24, M: 32, recipe: { ...d.spectrum.recipe, roughness: 1, bulge: 1, flutes: 1 } };
    return d;
  });
}

describe('every design is printable', () => {
  it.each(designs().map((d, i) => [i, d] as const))('design %i', (_, d) => {
    const { mesh, scale } = buildMesh(d, 'preview');
    const check = checkMesh(mesh);
    expect(check, `seed ${d.seed} ${d.body.kind}`).toMatchObject({ ok: true });

    const p = mesh.positions;
    const printer = printerById(d.print.printer);
    let minZ = Infinity, maxZ = -Infinity, maxX = 0, maxY = 0;
    for (let i = 0; i < p.length; i += 3) {
      minZ = Math.min(minZ, p[i + 2]);
      maxZ = Math.max(maxZ, p[i + 2]);
      maxX = Math.max(maxX, Math.abs(p[i]));
      maxY = Math.max(maxY, Math.abs(p[i + 1]));
    }
    expect(minZ).toBeCloseTo(0, 6);
    expect(maxZ).toBeLessThanOrEqual(printer.height + 1e-3);
    expect(maxZ).toBeCloseTo(scale.heightMm, 3);
    expect(2 * maxX).toBeLessThanOrEqual(printer.bed[0] - 2 * BED_MARGIN_MM + 1e-3);
    expect(2 * maxY).toBeLessThanOrEqual(printer.bed[1] - 2 * BED_MARGIN_MM + 1e-3);

    const again = buildMesh(d, 'preview').mesh;
    expect(again.positions).toEqual(mesh.positions);
  });
});
