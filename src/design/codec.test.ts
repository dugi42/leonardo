import { decodeDesign, encodeDesign } from './codec';
import { randomDesign } from './mutate';
import { defaultDesign } from './schema';

describe('codec', () => {
  it('round-trips random designs exactly', () => {
    for (let s = 0; s < 40; s++) {
      const d = randomDesign(s * 7919);
      expect(decodeDesign(encodeDesign(d))).toEqual(d);
    }
  });

  it('round-trips edits, body and print', () => {
    const d = {
      ...defaultDesign(5),
      spectrum: { ...defaultDesign(5).spectrum, edits: { '2,3': 1.25, '0,7': 0.8 } },
      body: { kind: 'planter' as const, wallMm: 2.4, floorMm: 3, holeMm: 10 },
      print: { printer: 'a1mini' as const, heightMm: 90 },
    };
    expect(decodeDesign(encodeDesign(d))).toEqual(d);
  });

  it('produces URL-safe text', () => {
    expect(encodeDesign(randomDesign(3))).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns null for garbage or unknown versions', () => {
    expect(decodeDesign('')).toBeNull();
    expect(decodeDesign('%%%')).toBeNull();
    expect(decodeDesign(btoa('{"v":3,"s":1}'))).toBeNull();
    expect(decodeDesign(btoa('not json'))).toBeNull();
  });
});

describe('codec versions', () => {
  it('round-trips the form', () => {
    const d = { ...defaultDesign(3), form: { archetype: 'amphora' as const, proportion: 0.3, rim: 'flare' as const, foot: 0.7 } };
    expect(decodeDesign(encodeDesign(d))).toEqual(d);
  });

  it('maps 3.0 links onto a cylinder of the old proportions', () => {
    const v1 = btoa(JSON.stringify({ v: 1, s: 9, k: [6, 9], r: [0.5, 0.3, 0.4, 0, 0, 12], m: [0.5, 1], b: [2, 2, 2, 8], p: ['p1s', 120] }))
      .replace(/=+$/, '');
    const d = decodeDesign(v1)!;
    expect(d.seed).toBe(9);
    expect(d.body.kind).toBe('hollow');
    expect(d.form).toEqual({ archetype: 'cylinder', proportion: 0.56, rim: 'flat', foot: 0 });
  });
});

describe('codec look', () => {
  it('round-trips colour and finish', () => {
    const d = { ...defaultDesign(3), look: { color: 'orange' as const, finish: 'matte' as const } };
    expect(decodeDesign(encodeDesign(d))).toEqual(d);
  });
});
