#!/usr/bin/env node
/** Downloads the artwork declared in media.manifest.json into public/media.
 *  The downloaded files are committed locally so runtime rendering remains
 *  available if an upstream asset is removed.
 *
 *  Usage: node scripts/fetch-media.mjs [--force]
 *  Already-downloaded files are skipped unless --force is passed. */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'media.manifest.json'), 'utf8'));
const force = process.argv.includes('--force');

/** Contentstack rejects the default Node user agent on some edges, so the
 *  request looks like the browser the asset was meant for. */
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  accept: '*/*',
};

async function exists(path) {
  try {
    const info = await stat(path);
    return info.size > 0;
  } catch {
    return false;
  }
}

function human(bytes) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

async function download(asset) {
  const target = join(root, manifest.baseDir, asset.path);

  if (!force && (await exists(target))) {
    return { path: asset.path, status: 'skipped' };
  }

  const response = await fetch(asset.url, { headers: HEADERS, redirect: 'follow' });
  if (!response.ok) {
    return { path: asset.path, status: 'failed', reason: `HTTP ${response.status}` };
  }

  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);
  return { path: asset.path, status: 'downloaded', bytes: body.byteLength };
}

// Sequential on purpose: a handful of files from one CDN, and a serial run gives
// a readable log and cannot look like an attack from the edge's point of view.
const results = [];
for (const asset of manifest.assets) {
  try {
    results.push(await download(asset));
  } catch (error) {
    results.push({ path: asset.path, status: 'failed', reason: String(error) });
  }
  const last = results[results.length - 1];
  const detail = last.bytes ? ` (${human(last.bytes)})` : last.reason ? ` — ${last.reason}` : '';
  console.log(`${last.status.padEnd(10)} ${last.path}${detail}`);
}

const failed = results.filter((r) => r.status === 'failed');
const downloaded = results.filter((r) => r.status === 'downloaded');
console.log(
  `\n${downloaded.length} downloaded, ${results.length - downloaded.length - failed.length} already present, ${failed.length} failed.`,
);

if (failed.length > 0) {
  console.error('\nSome assets could not be fetched. The pages that use them will fall back to');
  console.error('the theme gradient, so the site still builds, but it will look bare.');
  process.exit(1);
}
