import { encodeDesign } from '../design/codec';
import type { Design } from '../design/schema';
import { fileName, toStl } from '../engine/export/stl';
import { to3mf } from '../engine/export/threemf';
import { filamentById } from '../engine/materials';
import { buildMesh } from '../engine/mesh';
import { checkMesh } from '../engine/validate';

export type Format = 'stl' | '3mf';

export interface ExportedFile {
  bytes: Uint8Array;
  name: string;
  mime: string;
}

export const MIME: Record<Format, string> = {
  stl: 'model/stl',
  '3mf': 'model/3mf',
};

/** Export-resolution mesh to file bytes. Throws when the mesh fails validation. */
export function exportFile(design: Design, format: Format): ExportedFile {
  const { mesh } = buildMesh(design, 'export');
  const check = checkMesh(mesh);
  if (!check.ok) throw new Error(check.reason);
  const name = fileName(design, format);
  const hint =
    design.body.kind === 'vase' ? ' Print with Spiral vase mode enabled (Bambu Studio: Others > Spiral vase).' : '';
  const bytes =
    format === 'stl'
      ? toStl(mesh, name)
      : to3mf(mesh, {
          title: `Leonardo ${design.seed}`,
          description: `Leonardo design ${encodeDesign(design)}.${hint}`,
          color: { name: `PLA ${design.look.color}`, hex: filamentById(design.look.color).hex },
        });
  return { bytes, name, mime: MIME[format] };
}
