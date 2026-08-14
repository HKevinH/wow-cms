#!/usr/bin/env node
/** Builds GLB models for the storefront.
 *
 *  Deliberately offline and run by hand: the web server never opens a client
 *  archive, and production needs neither the game files nor this tool. What
 *  ships is the folder of GLBs it writes. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openArtSource } from './artSource';
import { readDbc } from './dbc';
import { mergeManifest, parseManifest, serialiseManifest } from './manifest';
import {
  convertDisplay,
  listDisplays,
  readDisplayArt,
  type ArtSource,
  type ConversionOutcome,
} from './pipeline';
import { DEFAULT_CHARACTER, resolveArt } from './resolve';

const USAGE = `
Usage:
  wowcms-models --art <dir> --dbc <dir> --out <dir> [options] [displayId...]

  --art        Extracted client art, holding Item/ObjectComponents
  --dbc        Folder holding ItemDisplayInfo.dbc
  --out        Where to write the models and manifest.json
  --from-api   Base URL of the CMS API; reads the published catalogue from
               /api/m/store/items so ids need not be typed out
  --all        Every display in the table that has a model of its own
  --character  Race and gender for head slot art (default ${DEFAULT_CHARACTER})

Head models exist once per race and gender, so a helmet is shown on one of
them rather than on the shopper's own character.
`;

interface Target {
  readonly displayId: number;
  readonly inventoryType: number;
}

function flag(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

async function targetsFromApi(baseUrl: string): Promise<Target[]> {
  const response = await fetch(new URL('/api/m/store/items', baseUrl));
  if (!response.ok) throw new Error(`the API answered ${response.status} for the item list`);
  const items = (await response.json()) as { displayId?: number; inventoryType?: number }[];
  return items
    .map((item) => ({ displayId: Number(item.displayId ?? 0), inventoryType: Number(item.inventoryType ?? 0) }))
    .filter((target) => target.displayId > 0);
}

function describe(outcome: ConversionOutcome): string {
  switch (outcome.kind) {
    case 'converted':
      return `built    ${outcome.displayId}  ${outcome.vertices} vertices, ${outcome.triangles} triangles`;
    case 'no-model':
      return `skipped  ${outcome.displayId}  armour drawn on the body, no model of its own`;
    case 'missing':
      return `missing  ${outcome.displayId}  ${outcome.modelName} is not in the art tree`;
    case 'no-texture':
      return `missing  ${outcome.displayId}  no texture for ${outcome.model}`;
  }
}

/** Displays sharing a mesh and a texture are the same model twice, and there
 *  are far more of those than there are distinct models: 23,975 displays in
 *  5.4.8 resolve to 10,957 pairs. Converting per pair rather than per display
 *  halves both the work and what the site has to carry. */
interface Group {
  readonly members: number[];
  readonly representative: Target;
}

function groupByArt(
  targets: readonly Target[],
  displays: ReturnType<typeof readDbc>,
  source: ArtSource,
  character: string,
): { groups: Map<string, Group>; unbuildable: ConversionOutcome[] } {
  const groups = new Map<string, Group>();
  const unbuildable: ConversionOutcome[] = [];

  for (const target of targets) {
    const display = readDisplayArt(displays, target.displayId);
    if (!display) {
      unbuildable.push({ kind: 'missing', displayId: target.displayId, modelName: 'no such display' });
      continue;
    }
    const art = resolveArt({ ...display, inventoryType: target.inventoryType, lookup: source, character });
    if (art.kind === 'no-model') {
      unbuildable.push({ kind: 'no-model', displayId: target.displayId });
      continue;
    }
    if (art.kind === 'missing') {
      unbuildable.push({ kind: 'missing', displayId: target.displayId, modelName: art.modelName });
      continue;
    }

    const key = `${art.model}|${art.texture ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.members.push(target.displayId);
      // The lowest id names the file, so a rebuild lands on the same name.
      if (target.displayId < existing.representative.displayId) {
        existing.members.sort((left, right) => left - right);
        groups.set(key, { members: existing.members, representative: target });
      }
    } else {
      groups.set(key, { members: [target.displayId], representative: target });
    }
  }

  return { groups, unbuildable };
}

async function main(argv: string[]): Promise<number> {
  const art = flag(argv, '--art');
  const dbcDir = flag(argv, '--dbc');
  const out = flag(argv, '--out');
  const character = flag(argv, '--character') ?? DEFAULT_CHARACTER;
  const fromApi = flag(argv, '--from-api');
  const all = argv.includes('--all');

  if (!art || !dbcDir || !out) {
    process.stderr.write(USAGE);
    return 1;
  }

  const dbcPath = join(dbcDir, 'ItemDisplayInfo.dbc');
  if (!existsSync(dbcPath)) {
    process.stderr.write(`No ItemDisplayInfo.dbc under ${dbcDir}\n`);
    return 1;
  }

  const named = new Set(['--art', '--dbc', '--out', '--character', '--from-api']);
  const explicit: Target[] = argv
    .filter((value, index) => !value.startsWith('--') && !named.has(argv[index - 1] ?? ''))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    // Without a slot the resolver searches every folder, which still finds
    // the art; it just cannot prefer the right one first.
    .map((displayId) => ({ displayId, inventoryType: 0 }));

  const displays = readDbc(new Uint8Array(readFileSync(dbcPath)));
  const source = openArtSource(art);
  process.stdout.write(`${source.size} art files indexed, ${displays.recordCount} displays in the table\n`);

  const targets: Target[] = [
    ...explicit,
    ...(fromApi ? await targetsFromApi(fromApi) : []),
    ...(all ? listDisplays(displays).map((row) => ({ displayId: row.displayId, inventoryType: 0 })) : []),
  ];
  if (targets.length === 0) {
    process.stderr.write('Nothing to build: pass display ids, --from-api, or --all.\n');
    return 1;
  }

  const { groups, unbuildable } = groupByArt(targets, displays, source, character);
  const loud = targets.length <= 60;
  process.stdout.write(
    `${targets.length} displays requested, ${groups.size} distinct models to build\n\n`,
  );

  mkdirSync(out, { recursive: true });
  const built: Record<string, string> = {};
  const counts = { converted: 0, 'no-model': 0, missing: 0, 'no-texture': 0 };

  for (const outcome of unbuildable) {
    counts[outcome.kind] += 1;
    if (loud) process.stdout.write(`${describe(outcome)}\n`);
  }

  let done = 0;
  for (const group of groups.values()) {
    const display = readDisplayArt(displays, group.representative.displayId)!;
    const outcome = convertDisplay({
      displayId: group.representative.displayId,
      inventoryType: group.representative.inventoryType,
      modelName: display.modelName,
      textureName: display.textureName,
      source,
      character,
    });

    if (outcome.kind === 'converted') {
      const file = `${outcome.displayId}.glb`;
      writeFileSync(join(out, file), outcome.glb);
      for (const member of group.members) built[String(member)] = file;
      counts.converted += group.members.length;
    } else {
      counts[outcome.kind] += group.members.length;
    }
    if (loud) process.stdout.write(`${describe(outcome)}\n`);

    done += 1;
    if (!loud && done % 500 === 0) {
      process.stdout.write(`  ${done} of ${groups.size} models built...\n`);
    }
  }

  const manifestPath = join(out, 'manifest.json');
  const previous = parseManifest(existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : undefined);
  const manifest = mergeManifest(previous.models, built);
  writeFileSync(manifestPath, serialiseManifest(manifest));

  process.stdout.write(
    `\n${counts.converted} displays built from ${groups.size} models, ` +
      `${counts['no-model']} without a model of their own, ` +
      `${counts.missing + counts['no-texture']} missing art. ` +
      `${Object.keys(manifest.models).length} displays in the catalogue.\n`,
  );
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
