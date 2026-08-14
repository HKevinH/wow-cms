/** Which display has which model file.
 *
 *  A map rather than a list because displays that share both mesh and texture
 *  are the same model twice: 23,975 displays resolve to 10,957 distinct pairs,
 *  so pointing several of them at one file halves what the site carries.
 *
 *  The site reads this rather than probing the filesystem per item, so a page
 *  render is one file read regardless of how large the catalogue grows. Any
 *  damage to it degrades to "no models", never to a broken storefront. */

export type ModelIndex = Readonly<Record<string, string>>;

export interface ModelManifest {
  readonly generatedAt: string;
  /** Display id to file name inside the models folder. */
  readonly models: ModelIndex;
}

export function mergeManifest(existing: ModelIndex, added: ModelIndex): ModelManifest {
  const combined = { ...existing, ...added };
  const models: Record<string, string> = {};
  // Numeric order, so a rebuild produces a diff a person can read.
  for (const key of Object.keys(combined).sort((left, right) => Number(left) - Number(right))) {
    models[key] = combined[key]!;
  }
  return { generatedAt: new Date().toISOString(), models };
}

export function serialiseManifest(manifest: ModelManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function parseManifest(contents: string | undefined): ModelManifest {
  const empty: ModelManifest = { generatedAt: '', models: {} };
  if (!contents) return empty;
  try {
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const listed = (parsed as { models?: unknown }).models;
    if (typeof listed !== 'object' || listed === null) return empty;
    const models: Record<string, string> = {};
    for (const [displayId, file] of Object.entries(listed as Record<string, unknown>)) {
      if (typeof file === 'string' && file !== '') models[displayId] = file;
    }
    return {
      generatedAt: String((parsed as { generatedAt?: unknown }).generatedAt ?? ''),
      models,
    };
  } catch {
    // A half-written file is possible whenever the tool was interrupted.
    return empty;
  }
}
