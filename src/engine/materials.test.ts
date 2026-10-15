import { FILAMENTS, filamentById, FINISHES, finishMaterial } from './materials';

describe('materials', () => {
  it('has unique filament ids with hex colours', () => {
    expect(new Set(FILAMENTS.map((f) => f.id)).size).toBe(FILAMENTS.length);
    for (const f of FILAMENTS) expect(f.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('falls back to white', () => {
    expect(filamentById('nope').id).toBe('white');
  });

  it('maps finishes to distinct physical materials', () => {
    const [matte, basic, silk] = FINISHES.map(finishMaterial);
    expect(matte.roughness).toBeGreaterThan(basic.roughness);
    expect(silk.metalness).toBeGreaterThan(basic.metalness);
    expect(silk.roughness).toBeLessThan(basic.roughness);
  });
});
