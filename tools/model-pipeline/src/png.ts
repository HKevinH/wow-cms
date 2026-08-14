/** Minimal PNG writer, enough to carry a decoded texture into a glTF.
 *
 *  Always eight bit truecolour with alpha and filter type 0. Choosing a real
 *  filter would shrink the file, but these textures are a few hundred pixels
 *  square and deflate already does the work. */
import { deflateSync } from 'node:zlib';
import type { DecodedImage } from './blp';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.byteLength);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const checked = new Uint8Array(typeBytes.byteLength + data.byteLength);
  checked.set(typeBytes, 0);
  checked.set(data, typeBytes.byteLength);
  view.setUint32(8 + data.byteLength, crc32(checked));
  return out;
}

export function encodePng(image: DecodedImage): Uint8Array {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, image.width);
  headerView.setUint32(4, image.height);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Each scanline carries its filter type as a leading byte.
  const stride = image.width * 4;
  const raw = new Uint8Array(image.height * (stride + 1));
  for (let row = 0; row < image.height; row += 1) {
    raw[row * (stride + 1)] = 0;
    raw.set(image.data.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }

  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const png = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    png.set(part, cursor);
    cursor += part.byteLength;
  }
  return png;
}
