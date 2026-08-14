/** Parser for the client's M2 models and their external .skin profiles.
 *
 *  Scope is a static, textured mesh: positions, normals, texture coordinates
 *  and triangles. Bones, animation and particles are read past, because a
 *  storefront turntable needs none of them.
 *
 *  Field offsets hold for MD20 from WotLK onward, which is what 5.4.8 ships —
 *  its models report version 272. In that layout the old `nViews`/`ofsViews`
 *  pair collapsed into a single count, because skin profiles moved out into
 *  their own files, and every offset after it shifted back four bytes. */

const MD20 = 0x3032444d; // 'MD20' little-endian
const SKIN = 0x4e494b53; // 'SKIN' little-endian

const OFS_NAME_LENGTH = 0x08;
const OFS_NAME_OFFSET = 0x0c;
const OFS_VERTEX_COUNT = 0x3c;
const OFS_VERTEX_OFFSET = 0x40;
const OFS_TEXTURE_COUNT = 0x50;
const OFS_TEXTURE_OFFSET = 0x54;

export const VERTEX_SIZE = 48;
const TEXTURE_ENTRY_SIZE = 16;
const SUBMESH_SIZE = 48;

export interface M2Texture {
  /** 0 is a filename baked into the model; anything else is replaced at
   *  runtime, which for items means the name comes from `ItemDisplayInfo`. */
  readonly type: number;
  readonly filename: string;
}

export interface M2Model {
  readonly version: number;
  readonly name: string;
  /** Interleaved xyz triples, already in glTF axes. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly textures: readonly M2Texture[];
}

export interface M2Skin {
  /** Triangle corners as indices into the model's vertices. */
  readonly indices: Uint32Array;
  readonly submeshCount: number;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  if (length <= 1 || offset === 0 || offset >= bytes.byteLength) return '';
  const end = Math.min(offset + length, bytes.byteLength);
  let stop = offset;
  while (stop < end && bytes[stop] !== 0) stop += 1;
  return new TextDecoder('utf-8').decode(bytes.subarray(offset, stop));
}

export function readM2(bytes: Uint8Array): M2Model {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 0x58 || view.getUint32(0, true) !== MD20) {
    throw new Error('not an MD20 model: wrong magic in the first four bytes');
  }

  const vertexCount = view.getUint32(OFS_VERTEX_COUNT, true);
  const vertexOffset = view.getUint32(OFS_VERTEX_OFFSET, true);

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  for (let index = 0; index < vertexCount; index += 1) {
    const base = vertexOffset + index * VERTEX_SIZE;
    const px = view.getFloat32(base, true);
    const py = view.getFloat32(base + 4, true);
    const pz = view.getFloat32(base + 8, true);
    const nx = view.getFloat32(base + 20, true);
    const ny = view.getFloat32(base + 24, true);
    const nz = view.getFloat32(base + 28, true);

    // Game space is Z-up, X forward, Y left. glTF is Y-up, X right, Z toward
    // the viewer. This permutation has determinant +1, so handedness — and
    // therefore triangle winding — is preserved.
    positions[index * 3] = -py;
    positions[index * 3 + 1] = pz;
    positions[index * 3 + 2] = -px;
    normals[index * 3] = -ny;
    normals[index * 3 + 1] = nz;
    normals[index * 3 + 2] = -nx;

    uvs[index * 2] = view.getFloat32(base + 32, true);
    uvs[index * 2 + 1] = view.getFloat32(base + 36, true);
  }

  const textureCount = view.getUint32(OFS_TEXTURE_COUNT, true);
  const textureOffset = view.getUint32(OFS_TEXTURE_OFFSET, true);
  const textures: M2Texture[] = [];
  for (let index = 0; index < textureCount; index += 1) {
    const base = textureOffset + index * TEXTURE_ENTRY_SIZE;
    textures.push({
      type: view.getUint32(base, true),
      filename: readString(bytes, view.getUint32(base + 12, true), view.getUint32(base + 8, true)),
    });
  }

  return {
    version: view.getUint32(0x04, true),
    name: readString(bytes, view.getUint32(OFS_NAME_OFFSET, true), view.getUint32(OFS_NAME_LENGTH, true)),
    positions,
    normals,
    uvs,
    textures,
  };
}

export function readSkin(bytes: Uint8Array): M2Skin {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 0x30 || view.getUint32(0, true) !== SKIN) {
    throw new Error('not a SKIN profile: wrong magic in the first four bytes');
  }

  const lookupCount = view.getUint32(0x04, true);
  const lookupOffset = view.getUint32(0x08, true);
  const triangleCount = view.getUint32(0x0c, true);
  const triangleOffset = view.getUint32(0x10, true);

  // Two levels of indirection: the triangle array indexes this lookup table,
  // and the lookup table indexes the model's vertices.
  const lookup = new Uint16Array(lookupCount);
  for (let index = 0; index < lookupCount; index += 1) {
    lookup[index] = view.getUint16(lookupOffset + index * 2, true);
  }

  const indices = new Uint32Array(triangleCount);
  for (let index = 0; index < triangleCount; index += 1) {
    indices[index] = lookup[view.getUint16(triangleOffset + index * 2, true)] ?? 0;
  }

  return { indices, submeshCount: view.getUint32(0x1c, true) };
}

export { SUBMESH_SIZE };
