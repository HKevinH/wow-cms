/** Synthetic client files, built byte by byte.
 *
 *  Binary fixtures are written here rather than committed as blobs so the
 *  layout each parser expects is stated in code a reader can check against
 *  the format, and so a test can vary one field at a time. */

const M2_HEADER_SIZE = 0x130;
export const M2_VERTEX_SIZE = 48;
export const BLP_HEADER_SIZE = 1172;

export interface FixtureVertex {
  readonly position: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
  readonly uv: readonly [number, number];
}

export interface M2Options {
  readonly version?: number;
  readonly name?: string;
  readonly textures?: readonly { type: number; filename: string }[];
}

export function buildM2(vertices: readonly FixtureVertex[], options: M2Options = {}): Uint8Array {
  const { version = 272, name = 'Test_Model', textures = [] } = options;
  const nameBytes = Buffer.from(`${name}\0`, 'utf8');
  const textureNames = textures.map((texture) => Buffer.from(`${texture.filename}\0`, 'utf8'));

  const nameOffset = M2_HEADER_SIZE;
  const vertexOffset = nameOffset + nameBytes.length;
  const textureOffset = vertexOffset + vertices.length * M2_VERTEX_SIZE;
  const stringOffset = textureOffset + textures.length * 16;

  const total = stringOffset + textureNames.reduce((sum, buffer) => sum + buffer.length, 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  bytes.set([0x4d, 0x44, 0x32, 0x30], 0); // 'MD20'
  view.setUint32(0x04, version, true);
  view.setUint32(0x08, nameBytes.length, true);
  view.setUint32(0x0c, nameOffset, true);
  view.setUint32(0x3c, vertices.length, true);
  view.setUint32(0x40, vertexOffset, true);
  view.setUint32(0x50, textures.length, true);
  view.setUint32(0x54, textureOffset, true);
  bytes.set(nameBytes, nameOffset);

  vertices.forEach((vertex, index) => {
    const base = vertexOffset + index * M2_VERTEX_SIZE;
    vertex.position.forEach((value, axis) => view.setFloat32(base + axis * 4, value, true));
    vertex.normal.forEach((value, axis) => view.setFloat32(base + 20 + axis * 4, value, true));
    vertex.uv.forEach((value, axis) => view.setFloat32(base + 32 + axis * 4, value, true));
  });

  let cursor = stringOffset;
  textures.forEach((texture, index) => {
    const base = textureOffset + index * 16;
    view.setUint32(base, texture.type, true);
    view.setUint32(base + 8, textureNames[index]!.length, true);
    view.setUint32(base + 12, cursor, true);
    bytes.set(textureNames[index]!, cursor);
    cursor += textureNames[index]!.length;
  });

  return bytes;
}

export function buildSkin(
  lookup: readonly number[],
  triangles: readonly number[],
  submeshCount = 1,
): Uint8Array {
  const SUBMESH_SIZE = 48;
  const lookupOffset = 0x30;
  const triangleOffset = lookupOffset + lookup.length * 2;
  const submeshOffset = triangleOffset + triangles.length * 2;
  const bytes = new Uint8Array(submeshOffset + submeshCount * SUBMESH_SIZE);
  const view = new DataView(bytes.buffer);

  bytes.set([0x53, 0x4b, 0x49, 0x4e], 0); // 'SKIN'
  view.setUint32(0x04, lookup.length, true);
  view.setUint32(0x08, lookupOffset, true);
  view.setUint32(0x0c, triangles.length, true);
  view.setUint32(0x10, triangleOffset, true);
  view.setUint32(0x1c, submeshCount, true);
  view.setUint32(0x20, submeshOffset, true);
  lookup.forEach((value, index) => view.setUint16(lookupOffset + index * 2, value, true));
  triangles.forEach((value, index) => view.setUint16(triangleOffset + index * 2, value, true));
  return bytes;
}

export interface BlpOptions {
  readonly encoding: number;
  readonly alphaDepth?: number;
  readonly alphaEncoding?: number;
  readonly width?: number;
  readonly height?: number;
  readonly palette?: readonly (readonly [number, number, number, number])[];
  readonly data: readonly number[];
}

export function buildBlp({
  encoding,
  alphaDepth = 0,
  alphaEncoding = 0,
  width = 4,
  height = 4,
  palette = [],
  data,
}: BlpOptions): Uint8Array {
  const bytes = new Uint8Array(BLP_HEADER_SIZE + data.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4c, 0x50, 0x32], 0); // 'BLP2'
  view.setUint32(4, 1, true); // direct colour, never the JPEG variant
  bytes[8] = encoding;
  bytes[9] = alphaDepth;
  bytes[10] = alphaEncoding;
  bytes[11] = 0;
  view.setUint32(12, width, true);
  view.setUint32(16, height, true);
  view.setUint32(20, BLP_HEADER_SIZE, true); // mip 0 offset
  view.setUint32(84, data.length, true); // mip 0 size
  palette.forEach(([b, g, r, a], index) => bytes.set([b, g, r, a], 148 + index * 4));
  bytes.set(data, BLP_HEADER_SIZE);
  return bytes;
}

/** A one pixel white texture, the smallest thing that decodes cleanly. */
export function buildTinyBlp(): Uint8Array {
  return buildBlp({ encoding: 3, width: 1, height: 1, data: [255, 255, 255, 255] });
}

/** A single triangle with a valid skin profile, for end to end exercises. */
export function buildTriangleModel(): { m2: Uint8Array; skin: Uint8Array } {
  return {
    m2: buildM2(
      [
        { position: [0, 0, 0], normal: [0, 0, 1], uv: [0, 0] },
        { position: [1, 0, 0], normal: [0, 0, 1], uv: [1, 0] },
        { position: [0, 1, 0], normal: [0, 0, 1], uv: [0, 1] },
      ],
      { textures: [{ type: 2, filename: '' }] },
    ),
    skin: buildSkin([0, 1, 2], [0, 1, 2]),
  };
}
