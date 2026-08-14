/** Which items have a 3D model, read once per render.
 *
 *  The manifest is written by the offline model pipeline into `public/models`.
 *  Reading it here rather than probing from the browser means a page arrives
 *  already knowing which items to mount a viewer for: no request that 404s,
 *  no icon that swaps to a model after the fact.
 *
 *  Everything degrades to the 2D icon. A site whose pipeline has never run,
 *  or whose manifest is half written, still renders a storefront. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODELS_PATH = '/models';

export interface ModelCatalogue {
  /** URL of this display's model, or undefined when it has none. */
  urlFor(displayId: number): string | undefined;
  readonly size: number;
}

/** Rejects anything that is not a plain file name. The manifest is generated
 *  rather than typed, but it still becomes a URL, and a name carrying a path
 *  should never turn into one. */
function isPlainFileName(name: string): boolean {
  return name !== '' && !name.includes('/') && !name.includes('\\') && !name.startsWith('.');
}

export function readModelCatalogue(contents: string | undefined): ModelCatalogue {
  const files = new Map<number, string>();
  if (contents) {
    try {
      const parsed: unknown = JSON.parse(contents);
      const listed = (parsed as { models?: unknown } | null)?.models;
      if (typeof listed === 'object' && listed !== null) {
        for (const [key, file] of Object.entries(listed as Record<string, unknown>)) {
          const displayId = Number(key);
          // Items published before the display was recorded carry 0, and the
          // pipeline keys nothing by it.
          if (!Number.isInteger(displayId) || displayId <= 0) continue;
          if (typeof file === 'string' && isPlainFileName(file)) files.set(displayId, file);
        }
      }
    } catch {
      // Leaves the catalogue empty, which reads as "no models yet".
    }
  }

  return {
    urlFor(displayId) {
      const file = files.get(displayId);
      return file === undefined ? undefined : `${MODELS_PATH}/${file}`;
    },
    size: files.size,
  };
}

let cached: ModelCatalogue | undefined;

/** Loads the manifest from the site's public folder, once per process. */
export function loadModelCatalogue(): ModelCatalogue {
  if (cached) return cached;
  const path = fileURLToPath(new URL('../../public/models/manifest.json', import.meta.url));
  let contents: string | undefined;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    contents = undefined;
  }
  cached = readModelCatalogue(contents);
  return cached;
}
