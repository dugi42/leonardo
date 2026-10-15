/** Coefficient grid size: k (height frequencies) x m (angular frequencies). */
export const KMAX = 24;
export const MMAX = 32;
/** Smallest relative radius; keeps every cross-section star-shaped and printable. */
export const R_MIN = 0.15;
/** Free space kept to each side of the bed, in millimetres. */
export const BED_MARGIN_MM = 10;

export const GRID = {
  preview: { nh: 96, nphi: 128 },
  export: { nh: 256, nphi: 384 },
} as const;
export type Resolution = keyof typeof GRID;
