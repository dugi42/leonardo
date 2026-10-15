export interface Printer {
  id: string;
  name: string;
  bed: [number, number];
  height: number;
}

// Build volumes in mm. H2D uses the smaller dual-nozzle volume (listings disagree).
export const PRINTERS = [
  { id: 'a1mini', name: 'A1 mini', bed: [180, 180], height: 180 },
  { id: 'a1', name: 'A1', bed: [256, 256], height: 256 },
  { id: 'p1s', name: 'P1S / P2S', bed: [256, 256], height: 256 },
  { id: 'x1c', name: 'X1C / X1E', bed: [256, 256], height: 256 },
  { id: 'h2s', name: 'H2S', bed: [340, 320], height: 340 },
  { id: 'h2d', name: 'H2D (dual nozzle)', bed: [300, 320], height: 325 },
  { id: 'custom', name: 'Custom 250', bed: [250, 250], height: 250 },
] as const satisfies readonly Printer[];

export type PrinterId = (typeof PRINTERS)[number]['id'];

export function printerById(id: string): Printer {
  return PRINTERS.find((p) => p.id === id) ?? PRINTERS[2];
}
