import { strToU8, zipSync } from 'fflate';
import type { Mesh } from '../mesh';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (x: number) => String(Math.round(x * 1e4) / 1e4);

export interface ThreeMfMeta {
  title: string;
  description: string;
}

/** Minimal 3MF core package (one object, millimetres) that Bambu Studio and others import. */
export function to3mf(mesh: Mesh, meta: ThreeMfMeta): Uint8Array {
  const p = mesh.positions;
  const f = mesh.indices;
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `<metadata name="Title">${escape(meta.title)}</metadata>`,
    `<metadata name="Description">${escape(meta.description)}</metadata>`,
    '<metadata name="Application">Leonardo</metadata>',
    '<resources><object id="1" type="model"><mesh><vertices>',
  ];
  for (let i = 0; i < p.length; i += 3) {
    parts.push(`<vertex x="${fmt(p[i])}" y="${fmt(p[i + 1])}" z="${fmt(p[i + 2])}"/>`);
  }
  parts.push('</vertices><triangles>');
  for (let t = 0; t < f.length; t += 3) {
    parts.push(`<triangle v1="${f[t]}" v2="${f[t + 1]}" v3="${f[t + 2]}"/>`);
  }
  parts.push('</triangles></mesh></object></resources>');
  parts.push('<build><item objectid="1"/></build></model>');
  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(RELS),
      '3D/3dmodel.model': strToU8(parts.join('\n')),
    },
    { level: 6 },
  );
}
