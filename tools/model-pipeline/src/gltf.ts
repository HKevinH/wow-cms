/** Writes a single textured mesh as a binary glTF.
 *
 *  One mesh, one primitive, one material, one embedded PNG. Everything a
 *  turntable needs and nothing it does not. */

const MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

export interface GlbMesh {
  /** Interleaved xyz triples in glTF axes. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  /** The base colour texture, already encoded. */
  readonly png: Uint8Array;
}

function padTo4(length: number): number {
  return (4 - (length % 4)) % 4;
}

function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index + axis]!;
      if (value < min[axis]!) min[axis] = value;
      if (value > max[axis]!) max[axis] = value;
    }
  }
  return positions.length === 0 ? { min: [0, 0, 0], max: [0, 0, 0] } : { min, max };
}

export function writeGlb(mesh: GlbMesh): Uint8Array {
  const blobs: Uint8Array[] = [
    new Uint8Array(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength),
    new Uint8Array(mesh.normals.buffer, mesh.normals.byteOffset, mesh.normals.byteLength),
    new Uint8Array(mesh.uvs.buffer, mesh.uvs.byteOffset, mesh.uvs.byteLength),
    new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength),
    mesh.png,
  ];

  const bufferViews: { buffer: number; byteOffset: number; byteLength: number; target?: number }[] = [];
  const targets = [ARRAY_BUFFER, ARRAY_BUFFER, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, undefined];
  let offset = 0;
  for (const [index, blob] of blobs.entries()) {
    bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: blob.byteLength,
      ...(targets[index] === undefined ? {} : { target: targets[index] }),
    });
    // Accessors read at their view's offset, so each view starts aligned.
    offset += blob.byteLength + padTo4(blob.byteLength);
  }

  const binary = new Uint8Array(offset);
  bufferViews.forEach((view, index) => binary.set(blobs[index]!, view.byteOffset));

  const { min, max } = bounds(mesh.positions);
  const gltf = {
    asset: { version: '2.0', generator: '@wowcms/model-pipeline' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.85,
        },
        // Item art relies on back faces; culling them opens holes in blades
        // and cloth.
        doubleSided: true,
      },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    images: [{ bufferView: 4, mimeType: 'image/png' }],
    accessors: [
      { bufferView: 0, componentType: FLOAT, count: mesh.positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: FLOAT, count: mesh.normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: FLOAT, count: mesh.uvs.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: UNSIGNED_INT, count: mesh.indices.length, type: 'SCALAR' },
    ],
    bufferViews,
    buffers: [{ byteLength: binary.byteLength }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonChunk = new Uint8Array(jsonBytes.byteLength + padTo4(jsonBytes.byteLength)).fill(0x20);
  jsonChunk.set(jsonBytes, 0);
  const binChunk = new Uint8Array(binary.byteLength + padTo4(binary.byteLength));
  binChunk.set(binary, 0);

  const total = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
  const glb = new Uint8Array(total);
  const view = new DataView(glb.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk.byteLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  glb.set(jsonChunk, 20);
  const binHeader = 20 + jsonChunk.byteLength;
  view.setUint32(binHeader, binChunk.byteLength, true);
  view.setUint32(binHeader + 4, BIN_CHUNK, true);
  glb.set(binChunk, binHeader + 8);
  return glb;
}
