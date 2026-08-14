import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng } from '../png';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Walks the chunk list so assertions can name a chunk instead of an offset. */
function chunks(png: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const found = new Map<string, Uint8Array>();
  let cursor = 8;
  while (cursor < png.byteLength) {
    const length = view.getUint32(cursor);
    const type = new TextDecoder().decode(png.subarray(cursor + 4, cursor + 8));
    found.set(type, png.subarray(cursor + 8, cursor + 8 + length));
    cursor += 12 + length;
  }
  return found;
}

const red = { width: 2, height: 1, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]) };

describe('encodePng', () => {
  it('opens with the PNG signature', () => {
    expect(Array.from(encodePng(red).subarray(0, 8))).toEqual(SIGNATURE);
  });

  it('describes the image as eight bit RGBA in the header', () => {
    const header = chunks(encodePng(red)).get('IHDR')!;
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(view.getUint32(0)).toBe(2); // width
    expect(view.getUint32(4)).toBe(1); // height
    expect(header[8]).toBe(8); // bit depth
    expect(header[9]).toBe(6); // colour type: truecolour with alpha
  });

  it('stores each row behind a filter byte', () => {
    // Every scanline is prefixed with its filter type. Omitting the prefix
    // still produces a file, just one whose pixels are shifted by a byte.
    const data = inflateSync(chunks(encodePng(red)).get('IDAT')!);
    expect(Array.from(data)).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 128]);
  });

  it('closes with an IEND chunk', () => {
    expect(chunks(encodePng(red)).has('IEND')).toBe(true);
  });

  it('checksums each chunk so a decoder accepts the file', () => {
    // A wrong CRC stays invisible until something other than our own code
    // reads the file. The expected value comes from zlib's crc32 over
    // 'IHDR' plus this header's thirteen bytes, computed outside this suite.
    const png = encodePng(red);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const length = view.getUint32(8);
    const stored = view.getUint32(8 + 8 + length);
    expect(stored).toBe(0xf4227f8a);
  });
});
