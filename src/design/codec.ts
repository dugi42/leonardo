import { FILAMENT_IDS, FINISHES } from '../engine/materials';
import { ARCHETYPE_IDS, RIMS } from '../engine/profile';
import { BODY_KINDS, normaliseDesign, type Design } from './schema';

/**
 * Compact, versioned URL payload. Arrays keep it short:
 * r = recipe [bulge, flutes, roughness, symmetry, ribs, ribFrequency],
 * m = modifiers [twist, edginess], b = body [kind, wall, floor, hole], p = print [printer, height],
 * f = form [archetype, proportion, rim, foot] (v2; v1 links predate forms),
 * l = look [colour, finish] (optional).
 */
interface Wire {
  v: 1 | 2;
  l?: [number, number];
  f?: [number, number, number, number];
  s: number;
  k: [number, number];
  r: number[];
  e?: Record<string, number>;
  m: [number, number];
  b: [number, number, number, number];
  p: [string, number];
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function encodeDesign(d: Design): string {
  const r = d.spectrum.recipe;
  const wire: Wire = {
    v: 2,
    s: d.seed,
    f: [ARCHETYPE_IDS.indexOf(d.form.archetype), d.form.proportion, RIMS.indexOf(d.form.rim), d.form.foot],
    k: [d.spectrum.K, d.spectrum.M],
    r: [r.bulge, r.flutes, r.roughness, r.symmetry, r.ribs, r.ribFrequency],
    m: [d.modifiers.twist, d.modifiers.edginess],
    b: [BODY_KINDS.indexOf(d.body.kind), d.body.wallMm, d.body.floorMm, d.body.holeMm],
    p: [d.print.printer, d.print.heightMm],
  };
  if (Object.keys(d.spectrum.edits).length) wire.e = d.spectrum.edits;
  wire.l = [FILAMENT_IDS.indexOf(d.look.color), FINISHES.indexOf(d.look.finish)];
  return toBase64Url(JSON.stringify(wire));
}

/** Tolerant decode: anything unreadable or from an unknown version gives null. */
export function decodeDesign(payload: string): Design | null {
  let wire: Partial<Wire>;
  try {
    wire = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (!wire || (wire.v !== 1 && wire.v !== 2)) return null;
  const f = wire.f ?? [];
  const [bulge, flutes, roughness, symmetry, ribs, ribFrequency] = wire.r ?? [];
  return normaliseDesign({
    v: wire.v,
    seed: wire.s,
    form: wire.v === 1 ? undefined : { archetype: ARCHETYPE_IDS[f[0] ?? -1], proportion: f[1], rim: RIMS[f[2] ?? -1], foot: f[3] },
    spectrum: {
      K: wire.k?.[0],
      M: wire.k?.[1],
      recipe: { bulge, flutes, roughness, symmetry, ribs, ribFrequency },
      edits: wire.e,
    },
    modifiers: { twist: wire.m?.[0], edginess: wire.m?.[1] },
    body: { kind: BODY_KINDS[wire.b?.[0] ?? -1], wallMm: wire.b?.[1], floorMm: wire.b?.[2], holeMm: wire.b?.[3] },
    print: { printer: wire.p?.[0], heightMm: wire.p?.[1] },
    look: { color: FILAMENT_IDS[wire.l?.[0] ?? -1], finish: FINISHES[wire.l?.[1] ?? -1] },
  });
}
