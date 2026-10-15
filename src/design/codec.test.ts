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
    expect(decodeDesign(btoa('{"v":2,"s":1}'))).toBeNull();
    expect(decodeDesign(btoa('not json'))).toBeNull();
  });
});
