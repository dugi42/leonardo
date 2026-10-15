import { defaultDesign, type Design } from '../design/schema';

/** A plain cylinder whose raw height is exactly 2.5, so 100 mm tall means radius 40 mm. */
export const CYLINDER_25 = { archetype: 'cylinder', proportion: 1.9 / 3.4, rim: 'flat', foot: 0 } as const;

export function cylinderDesign(patch: Partial<Design['body']> = {}): Design {
  const d = defaultDesign(3);
  return {
    ...d,
    form: { ...CYLINDER_25 },
    spectrum: { ...d.spectrum, K: 1, M: 1 },
    body: { ...d.body, ...patch },
    print: { printer: 'x1c', heightMm: 100 },
  };
}
