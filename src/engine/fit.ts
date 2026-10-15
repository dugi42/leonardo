import type { PrintSettings } from '../design/schema';
import { BED_MARGIN_MM, H0 } from './constants';
import { printerById } from './printers';
import type { Field } from './surface';

export interface PrintScale {
  /** Millimetres per raw unit. */
  sigma: number;
  /** Actual printed height. */
  heightMm: number;
  /** True when the printer's bed or build height forced a smaller size than requested. */
  capped: boolean;
  /** xy translation in mm that centres the footprint on the origin. */
  offset: [number, number];
}

export function printScale(field: Field, print: PrintSettings): PrintScale {
  const printer = printerById(print.printer);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < field.nh; i++) {
    for (let j = 0; j < field.nphi; j++) {
      const r = field.r[i * field.nphi + j];
      const x = r * Math.cos(field.phi[j]);
      const y = r * Math.sin(field.phi[j]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const wanted = print.heightMm / H0;
  const sigma = Math.min(
    wanted,
    printer.height / H0,
    (printer.bed[0] - 2 * BED_MARGIN_MM) / (maxX - minX),
    (printer.bed[1] - 2 * BED_MARGIN_MM) / (maxY - minY),
  );
  return {
    sigma,
    heightMm: sigma * H0,
    capped: sigma < wanted - 1e-9,
    offset: [(-(minX + maxX) / 2) * sigma, (-(minY + maxY) / 2) * sigma],
  };
}
