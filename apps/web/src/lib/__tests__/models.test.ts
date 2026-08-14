import { describe, expect, it } from 'vitest';
import { readModelCatalogue } from '../models';

describe('readModelCatalogue', () => {
  it('gives the URL of the model built for a display', () => {
    const catalogue = readModelCatalogue('{"models":{"1685":"1685.glb"}}');
    expect(catalogue.urlFor(1685)).toBe('/models/1685.glb');
  });

  it('points several displays at one shared model', () => {
    // Displays that share a mesh and a texture share the file, which is why
    // the manifest maps rather than lists.
    const catalogue = readModelCatalogue('{"models":{"1621":"1621.glb","2380":"1621.glb"}}');
    expect(catalogue.urlFor(2380)).toBe('/models/1621.glb');
  });

  it('gives nothing for a display with no model', () => {
    expect(readModelCatalogue('{"models":{"1685":"1685.glb"}}').urlFor(9999)).toBeUndefined();
  });

  it('treats a site with no manifest as a site with no models', () => {
    // The storefront has to render before the pipeline has ever run, falling
    // back to the 2D icons it has always shown.
    expect(readModelCatalogue(undefined).urlFor(1685)).toBeUndefined();
    expect(readModelCatalogue(undefined).size).toBe(0);
  });

  it('survives a manifest it cannot parse', () => {
    expect(readModelCatalogue('{ truncated').size).toBe(0);
  });

  it('ignores entries whose file name is not a string', () => {
    expect(readModelCatalogue('{"models":{"1685":"a.glb","3092":42}}').size).toBe(1);
  });

  it('gives nothing for the zero display', () => {
    // Items published before the display was recorded carry 0, and no art is
    // keyed by it.
    expect(readModelCatalogue('{"models":{"0":"0.glb"}}').urlFor(0)).toBeUndefined();
  });

  it('refuses a file name that would climb out of the models folder', () => {
    // The manifest is generated, not user input, but it is still a file the
    // site turns into a URL; a name with a path in it should not become one.
    expect(readModelCatalogue('{"models":{"1685":"../../secrets.txt"}}').urlFor(1685)).toBeUndefined();
  });
});
