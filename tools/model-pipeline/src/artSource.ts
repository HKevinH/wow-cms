/** Reads the extracted client art off disk.
 *
 *  The tree is indexed once at startup rather than probed per lookup: the
 *  client's own casing is inconsistent even inside a single folder, so every
 *  path has to be matched case-insensitively, and doing that with a directory
 *  read per candidate would be slower than walking the tree once. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ArtSource } from './pipeline';

function walk(base: string, directory: string, into: Map<string, string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(base, full, into);
    } else {
      const key = relative(base, full).split(sep).join('/').toLowerCase();
      into.set(key, full);
    }
  }
}

export interface FileArtSource extends ArtSource {
  /** How many files the tree holds, for the tool to report at startup. */
  readonly size: number;
}

export function openArtSource(root: string): FileArtSource {
  const index = new Map<string, string>();
  walk(root, root, index);

  return {
    size: index.size,
    has: (path) => index.has(path.toLowerCase()),
    read: (path) => {
      const found = index.get(path.toLowerCase());
      if (!found) throw new Error(`not in the extracted art tree: ${path}`);
      return new Uint8Array(readFileSync(found));
    },
  };
}
