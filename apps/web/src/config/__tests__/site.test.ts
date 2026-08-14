import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSiteConfig, remoteAssetPaths } from '../site';

interface Manifest {
  baseDir: string;
  assets: { path: string; url: string }[];
}

const manifest: Manifest = JSON.parse(
  readFileSync(new URL('../../../media.manifest.json', import.meta.url), 'utf8'),
);

describe('media manifest', () => {
  it('declares every remote asset the site config points at', () => {
    const declared = new Set(manifest.assets.map((asset) => asset.path));
    const undeclared = remoteAssetPaths().filter((used) => !declared.has(used));

    // Without this check, adding an image to the config and forgetting the
    // manifest gives a page that builds fine and 404s the artwork in a browser.
    expect(undeclared).toEqual([]);
  });

  it('downloads into the directory git ignores', () => {
    expect(manifest.baseDir).toBe('public/media');
  });

  it('fetches every asset over https', () => {
    const insecure = manifest.assets.filter((asset) => !asset.url.startsWith('https://'));
    expect(insecure).toEqual([]);
  });

  it('gives each asset a distinct local path', () => {
    const paths = manifest.assets.map((asset) => asset.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('site config', () => {
  it('offers the hero video in more than one container', () => {
    const types = getSiteConfig().media.hero.sources.map((source) => source.type);
    expect(types).toContain('video/webm');
    expect(types).toContain('video/mp4');
  });

  it('always has a poster, so a browser that blocks autoplay still shows artwork', () => {
    expect(getSiteConfig().media.hero.poster).toBeTruthy();
  });
});
