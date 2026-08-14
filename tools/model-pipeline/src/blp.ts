/** Decoder for BLP2, the client's texture container, down to straight RGBA.
 *
 *  Three storage forms appear in 5.4.8 art: a 256 entry palette, S3TC block
 *  compression (DXT1/3/5), and plain uncompressed BGRA. Only the largest mip
 *  level is read — a storefront turntable has no use for the smaller ones. */

const MAGIC = 0x32504c42; // 'BLP2' little-endian

/** Fixed prologue: magic, type, four encoding bytes, dimensions, the two mip
 *  tables of sixteen entries each, then the palette. */
export const BLP_HEADER_SIZE = 1172;
const PALETTE_OFFSET = 148;

const ENCODING_PALETTE = 1;
const ENCODING_DXT = 2;
const ENCODING_BGRA = 3;

const ALPHA_DXT1 = 0;
const ALPHA_DXT3 = 1;
const ALPHA_DXT5 = 7;

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  /** Interleaved RGBA, one byte per channel, top row first. */
  readonly data: Uint8Array;
}

/** Widens a 5:6:5 colour to eight bits per channel by repeating the high bits,
 *  which is what maps 31 onto 255 rather than 248. */
function expand565(value: number): [number, number, number] {
  const r = (value >> 11) & 0x1f;
  const g = (value >> 5) & 0x3f;
  const b = value & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function decodeColourBlock(
  view: DataView,
  offset: number,
  out: Uint8Array,
  width: number,
  height: number,
  blockX: number,
  blockY: number,
  opaque: boolean,
): void {
  const first = view.getUint16(offset, true);
  const second = view.getUint16(offset + 2, true);
  const bits = view.getUint32(offset + 4, true);
  const [r0, g0, b0] = expand565(first);
  const [r1, g1, b1] = expand565(second);

  // A first endpoint above the second selects the four colour ramp; otherwise
  // the fourth slot is transparent black and the third is a plain midpoint.
  const wide = first > second || opaque;
  const palette: [number, number, number, number][] = [
    [r0, g0, b0, 255],
    [r1, g1, b1, 255],
    wide
      ? [Math.round((2 * r0 + r1) / 3), Math.round((2 * g0 + g1) / 3), Math.round((2 * b0 + b1) / 3), 255]
      : [Math.round((r0 + r1) / 2), Math.round((g0 + g1) / 2), Math.round((b0 + b1) / 2), 255],
    wide
      ? [Math.round((r0 + 2 * r1) / 3), Math.round((g0 + 2 * g1) / 3), Math.round((b0 + 2 * b1) / 3), 255]
      : [0, 0, 0, 0],
  ];

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const x = blockX + column;
      const y = blockY + row;
      if (x >= width || y >= height) continue;
      const selector = (bits >>> (2 * (row * 4 + column))) & 0b11;
      const colour = palette[selector]!;
      const target = (y * width + x) * 4;
      out[target] = colour[0];
      out[target + 1] = colour[1];
      out[target + 2] = colour[2];
      out[target + 3] = colour[3];
    }
  }
}

function decodeAlphaBlock(
  view: DataView,
  offset: number,
  out: Uint8Array,
  width: number,
  height: number,
  blockX: number,
  blockY: number,
  mode: number,
): void {
  if (mode === ALPHA_DXT3) {
    for (let index = 0; index < 16; index += 1) {
      const x = blockX + (index % 4);
      const y = blockY + Math.floor(index / 4);
      if (x >= width || y >= height) continue;
      const nibble = (view.getUint8(offset + (index >> 1)) >> ((index & 1) * 4)) & 0x0f;
      out[(y * width + x) * 4 + 3] = nibble * 17;
    }
    return;
  }

  const first = view.getUint8(offset);
  const second = view.getUint8(offset + 1);
  const ramp = [first, second];
  if (first > second) {
    for (let step = 1; step <= 6; step += 1) ramp.push(Math.round(((7 - step) * first + step * second) / 7));
  } else {
    for (let step = 1; step <= 4; step += 1) ramp.push(Math.round(((5 - step) * first + step * second) / 5));
    ramp.push(0, 255);
  }

  // Sixteen three bit selectors packed into six bytes, read as one little
  // endian run rather than byte by byte so selectors may straddle a boundary.
  let packed = 0n;
  for (let byte = 0; byte < 6; byte += 1) {
    packed |= BigInt(view.getUint8(offset + 2 + byte)) << BigInt(8 * byte);
  }
  for (let index = 0; index < 16; index += 1) {
    const x = blockX + (index % 4);
    const y = blockY + Math.floor(index / 4);
    if (x >= width || y >= height) continue;
    const selector = Number((packed >> BigInt(3 * index)) & 0b111n);
    out[(y * width + x) * 4 + 3] = ramp[selector]!;
  }
}

export function decodeBlp(bytes: Uint8Array): DecodedImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < BLP_HEADER_SIZE || view.getUint32(0, true) !== MAGIC) {
    throw new Error('not a BLP2 texture: wrong magic in the first four bytes');
  }

  const encoding = view.getUint8(8);
  const alphaDepth = view.getUint8(9);
  const alphaEncoding = view.getUint8(10);
  const width = view.getUint32(12, true);
  const height = view.getUint32(16, true);
  const mipOffset = view.getUint32(20, true);

  const data = new Uint8Array(width * height * 4);

  if (encoding === ENCODING_BGRA) {
    for (let index = 0; index < width * height; index += 1) {
      const source = mipOffset + index * 4;
      data[index * 4] = bytes[source + 2] ?? 0;
      data[index * 4 + 1] = bytes[source + 1] ?? 0;
      data[index * 4 + 2] = bytes[source] ?? 0;
      data[index * 4 + 3] = bytes[source + 3] ?? 0;
    }
    return { width, height, data };
  }

  if (encoding === ENCODING_PALETTE) {
    const pixels = width * height;
    for (let index = 0; index < pixels; index += 1) {
      const entry = PALETTE_OFFSET + (bytes[mipOffset + index] ?? 0) * 4;
      data[index * 4] = bytes[entry + 2] ?? 0;
      data[index * 4 + 1] = bytes[entry + 1] ?? 0;
      data[index * 4 + 2] = bytes[entry] ?? 0;
      data[index * 4 + 3] = 255;
    }
    if (alphaDepth === 8) {
      const alphaStart = mipOffset + pixels;
      for (let index = 0; index < pixels; index += 1) {
        data[index * 4 + 3] = bytes[alphaStart + index] ?? 255;
      }
    } else if (alphaDepth === 1) {
      const alphaStart = mipOffset + pixels;
      for (let index = 0; index < pixels; index += 1) {
        const bit = (bytes[alphaStart + (index >> 3)] ?? 0xff) >> (index & 7);
        data[index * 4 + 3] = (bit & 1) === 1 ? 255 : 0;
      }
    }
    return { width, height, data };
  }

  if (encoding === ENCODING_DXT) {
    const withAlphaBlock = alphaEncoding === ALPHA_DXT3 || alphaEncoding === ALPHA_DXT5;
    const blockSize = withAlphaBlock ? 16 : 8;
    let cursor = mipOffset;
    for (let blockY = 0; blockY < height; blockY += 4) {
      for (let blockX = 0; blockX < width; blockX += 4) {
        if (withAlphaBlock) {
          decodeColourBlock(view, cursor + 8, data, width, height, blockX, blockY, true);
          decodeAlphaBlock(view, cursor, data, width, height, blockX, blockY, alphaEncoding);
        } else {
          decodeColourBlock(view, cursor, data, width, height, blockX, blockY, false);
        }
        cursor += blockSize;
      }
    }
    return { width, height, data };
  }

  throw new Error(
    `unsupported BLP encoding ${encoding}: only palettised, DXT and uncompressed BGRA appear in 5.4.8 art`,
  );
}

export { ALPHA_DXT1, ALPHA_DXT3, ALPHA_DXT5 };
