import type { Design } from '../design/schema';

type Renderer = (design: Design) => string | undefined;
let renderer: Promise<Renderer | null> | null = null;
const cache = new Map<string, string>();

/**
 * Renders a design to a small PNG data URL with one shared offscreen WebGL renderer,
 * so a grid of thumbnails costs one WebGL context. Resolves undefined without WebGL.
 */
export async function renderThumbnail(design: Design, key: string): Promise<string | undefined> {
  const hit = cache.get(key);
  if (hit) return hit;
  renderer ??= import('./thumbnailRenderer').then((m) => m.createThumbnailRenderer()).catch(() => null);
  const render = await renderer;
  if (!render) return undefined;
  try {
    const url = render(design);
    if (url) {
      cache.set(key, url);
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
    }
    return url;
  } catch {
    return undefined;
  }
}
