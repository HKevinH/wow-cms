import { describe, expect, it } from 'vitest';
import { BLP_HEADER_SIZE, decodeBlp } from '../blp';
import { buildBlp } from './fixtures';

const pixel = (image: { data: Uint8Array }, index: number): number[] =>
  Array.from(image.data.subarray(index * 4, index * 4 + 4));

describe('decodeBlp', () => {
  it('rejects a file that is not BLP2', () => {
    expect(() => decodeBlp(new Uint8Array(BLP_HEADER_SIZE))).toThrow(/BLP2/);
  });

  it('reports the image dimensions', () => {
    const image = decodeBlp(buildBlp({ encoding: 3, width: 2, height: 2, data: new Array(16).fill(0) }));
    expect([image.width, image.height]).toEqual([2, 2]);
  });

  it('reorders uncompressed BGRA into RGBA', () => {
    // The channel order is the single easiest thing to get backwards, and a
    // swapped red and blue looks plausible enough to ship by accident.
    const image = decodeBlp(
      buildBlp({ encoding: 3, width: 1, height: 1, data: [10, 20, 30, 40] }),
    );
    expect(pixel(image, 0)).toEqual([30, 20, 10, 40]);
  });

  it('expands a palettised image through its palette', () => {
    const image = decodeBlp(
      buildBlp({
        encoding: 1,
        width: 2,
        height: 1,
        palette: [
          [255, 0, 0, 0],
          [0, 255, 0, 0],
        ],
        data: [0, 1],
      }),
    );
    expect(pixel(image, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(image, 1)).toEqual([0, 255, 0, 255]);
  });

  it('reads per-pixel alpha when the palette carries eight bits of it', () => {
    const image = decodeBlp(
      buildBlp({
        encoding: 1,
        alphaDepth: 8,
        width: 2,
        height: 1,
        palette: [[255, 255, 255, 0]],
        data: [0, 0, 0x11, 0x22],
      }),
    );
    expect(pixel(image, 0)[3]).toBe(0x11);
    expect(pixel(image, 1)[3]).toBe(0x22);
  });

  it('decodes a DXT1 block into its two endpoint colours', () => {
    // color0 (red) sorts above color1 (blue), which selects the four colour
    // mode; indices pick endpoint 0 then endpoint 1.
    const block = [0x00, 0xf8, 0x1f, 0x00, 0x04, 0x00, 0x00, 0x00];
    const image = decodeBlp(buildBlp({ encoding: 2, alphaEncoding: 0, data: block }));
    expect(pixel(image, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(image, 1)).toEqual([0, 0, 255, 255]);
  });

  it('reads the interpolated alpha ramp of a DXT5 block', () => {
    // alpha0 = 255 and alpha1 = 0 with index 0 everywhere means fully opaque;
    // index 1 selects alpha1, the transparent end of the ramp.
    const alpha = [255, 0, 0b00001000, 0x00, 0x00, 0x00, 0x00, 0x00];
    const colour = [0x00, 0xf8, 0x1f, 0x00, 0x00, 0x00, 0x00, 0x00];
    const image = decodeBlp(buildBlp({ encoding: 2, alphaEncoding: 7, data: [...alpha, ...colour] }));
    expect(pixel(image, 0)[3]).toBe(255);
    expect(pixel(image, 1)[3]).toBe(0);
  });

  it('refuses an encoding it does not implement rather than guessing', () => {
    expect(() => decodeBlp(buildBlp({ encoding: 9, data: [] }))).toThrow(/encoding 9/);
  });
});
