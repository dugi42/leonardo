import { KMAX, MMAX } from '../engine/constants';
import { FILAMENT_IDS, FINISHES, type FilamentId, type Finish } from '../engine/materials';
import { PRINTERS, type PrinterId } from '../engine/printers';
import { ARCHETYPE_IDS, ARCHETYPES, RIMS, type ArchetypeId, type Rim } from '../engine/profile';

export type BodyKind = 'solid' | 'vase' | 'hollow' | 'planter';
export const BODY_KINDS: readonly BodyKind[] = ['solid', 'vase', 'hollow', 'planter'];

export interface Recipe {
  bulge: number;
  flutes: number;
  roughness: number;
  symmetry: number;
  ribs: number;
  ribFrequency: number;
}

export interface Spectrum {
  K: number;
  M: number;
  recipe: Recipe;
  /** "k,m" -> magnitude gain. Gain 1 is never stored. */
  edits: Record<string, number>;
}

export interface Modifiers {
  /** Turns over the full height. */
  twist: number;
  /** 0 round, 5 nearly square. */
  edginess: number;
}

export interface Body {
  kind: BodyKind;
  wallMm: number;
  floorMm: number;
  holeMm: number;
}

export interface PrintSettings {
  printer: PrinterId;
  heightMm: number;
}

export interface Form {
  archetype: ArchetypeId;
  /** 0 slender .. 1 squat */
  proportion: number;
  rim: Rim;
  /** 0 none .. 1 pronounced pedestal */
  foot: number;
}

export interface Look {
  color: FilamentId;
  finish: Finish;
}

export interface Design {
  v: 2;
  seed: number;
  form: Form;
  spectrum: Spectrum;
  modifiers: Modifiers;
  body: Body;
  print: PrintSettings;
  look: Look;
}

type Range = readonly [number, number];

export const RANGES = {
  K: [1, KMAX],
  M: [1, MMAX],
  bulge: [0, 1],
  flutes: [0, 1],
  roughness: [0, 1],
  symmetry: [0, 12],
  ribs: [0, 1],
  ribFrequency: [3, MMAX - 1],
  gain: [0, 4],
  twist: [-2, 2],
  edginess: [0, 5],
  wallMm: [0.8, 10],
  floorMm: [0.8, 10],
  holeMm: [0, 40],
  heightMm: [20, 400],
  proportion: [0, 1],
  foot: [0, 1],
} as const satisfies Record<string, Range>;

const INTEGER_FIELDS = new Set(['K', 'M', 'symmetry', 'ribFrequency']);

export function defaultDesign(seed: number): Design {
  return {
    v: 2,
    seed: seed >>> 0,
    form: { archetype: 'vase', proportion: ARCHETYPES.vase.proportion, rim: 'flat', foot: 0 },
    spectrum: {
      K: 8,
      M: 12,
      recipe: { bulge: 0.5, flutes: 0.3, roughness: 0.4, symmetry: 0, ribs: 0, ribFrequency: 12 },
      edits: {},
    },
    modifiers: { twist: 0, edginess: 0 },
    body: { kind: 'solid', wallMm: 2, floorMm: 2, holeMm: 8 },
    print: { printer: 'p1s', heightMm: 120 },
    look: { color: 'white', finish: 'basic' },
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(src: unknown, key: keyof typeof RANGES, fallback: number): number {
  const raw = isObject(src) ? src[key] : undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  const [lo, hi] = RANGES[key];
  const v = Math.min(hi, Math.max(lo, raw));
  return INTEGER_FIELDS.has(key) ? Math.round(v) : v;
}

function normaliseEdits(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [key, gain] of Object.entries(raw)) {
    const m = /^(\d+),(\d+)$/.exec(key);
    if (!m || typeof gain !== 'number' || !Number.isFinite(gain)) continue;
    const k = Number(m[1]);
    const mm = Number(m[2]);
    if (k >= KMAX || mm >= MMAX) continue;
    const g = Math.min(RANGES.gain[1], Math.max(RANGES.gain[0], gain));
    if (g !== 1) out[`${k},${mm}`] = g;
  }
  return out;
}

/** Clamp and complete any input into a valid Design; null when it has no usable seed. */
export function normaliseDesign(input: unknown): Design | null {
  if (!isObject(input) || typeof input.seed !== 'number' || !Number.isFinite(input.seed)) {
    return null;
  }
  const seed = input.seed >>> 0;
  const d = defaultDesign(seed);
  const sp = isObject(input.spectrum) ? input.spectrum : {};
  const rc = isObject(sp.recipe) ? sp.recipe : {};
  const r = d.spectrum.recipe;
  const body = isObject(input.body) ? input.body : {};
  const print = isObject(input.print) ? input.print : {};
  const kind = BODY_KINDS.includes(body.kind as BodyKind) ? (body.kind as BodyKind) : d.body.kind;
  const form = isObject(input.form) ? input.form : {};
  const archetype = ARCHETYPE_IDS.includes(form.archetype as ArchetypeId)
    ? (form.archetype as ArchetypeId)
    : d.form.archetype;
  const rim = RIMS.includes(form.rim as Rim) ? (form.rim as Rim) : d.form.rim;
  const look = isObject(input.look) ? input.look : {};
  const color = FILAMENT_IDS.includes(look.color as FilamentId) ? (look.color as FilamentId) : d.look.color;
  const finish = FINISHES.includes(look.finish as Finish) ? (look.finish as Finish) : d.look.finish;
  const printer = PRINTERS.some((p) => p.id === print.printer)
    ? (print.printer as PrinterId)
    : d.print.printer;
  return {
    v: 2,
    seed,
    form: {
      archetype,
      proportion: num(form, 'proportion', d.form.proportion),
      rim,
      foot: num(form, 'foot', d.form.foot),
    },
    spectrum: {
      K: num(sp, 'K', d.spectrum.K),
      M: num(sp, 'M', d.spectrum.M),
      recipe: {
        bulge: num(rc, 'bulge', r.bulge),
        flutes: num(rc, 'flutes', r.flutes),
        roughness: num(rc, 'roughness', r.roughness),
        symmetry: num(rc, 'symmetry', r.symmetry),
        ribs: num(rc, 'ribs', r.ribs),
        ribFrequency: num(rc, 'ribFrequency', r.ribFrequency),
      },
      edits: normaliseEdits(sp.edits),
    },
    modifiers: {
      twist: num(input.modifiers, 'twist', d.modifiers.twist),
      edginess: num(input.modifiers, 'edginess', d.modifiers.edginess),
    },
    body: {
      kind,
      wallMm: num(body, 'wallMm', d.body.wallMm),
      floorMm: num(body, 'floorMm', d.body.floorMm),
      holeMm: num(body, 'holeMm', d.body.holeMm),
    },
    print: { printer, heightMm: num(print, 'heightMm', d.print.heightMm) },
    look: { color, finish },
  };
}
