import { describe, expect, it } from 'vitest';
import { parseGlb, readAccessor } from '../itemModelViewer';

/** Builds a GLB by the specification, independently of the tool that writes
 *  them, so this suite pins the reader to the format rather than to whatever
 *  the pipeline happens to emit today. */
function buildGlb(json: object, bin: Uint8Array): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonLength = jsonBytes.length + jsonPad;
  const binLength = bin.length + binPad;

  const glb = new Uint8Array(12 + 8 + jsonLength + 8 + binLength);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.fill(0x20, 20 + jsonBytes.length, 20 + jsonLength);
  glb.set(jsonBytes, 20);
  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, binLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  glb.set(bin, binHeader + 8);
  return glb;
}

const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]);
const indices = new Uint32Array([0, 1, 2]);

const bin = new Uint8Array(positions.byteLength + indices.byteLength);
bin.set(new Uint8Array(positions.buffer), 0);
bin.set(new Uint8Array(indices.buffer), positions.byteLength);

const document = {
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0] },
    { bufferView: 1, componentType: 5125, count: 3, type: 'SCALAR' },
    { bufferView: 0, componentType: 5122, count: 1, type: 'SCALAR' },
  ],
  bufferViews: [
    { byteOffset: 0, byteLength: positions.byteLength },
    { byteOffset: positions.byteLength, byteLength: indices.byteLength },
  ],
};

describe('parseGlb', () => {
  it('splits the container into its JSON and binary chunks', () => {
    const parsed = parseGlb(buildGlb(document, bin));
    expect(parsed.gltf.accessors).toHaveLength(3);
    expect(parsed.bin.byteLength).toBe(bin.byteLength);
  });

  it('refuses a file that is not a GLB', () => {
    expect(() => parseGlb(new Uint8Array(32))).toThrow(/GLB/);
  });

  it('refuses a container missing its binary chunk', () => {
    // A JSON-only glTF is legal but has nothing to draw, and failing here
    // lets the storefront fall back to the icon rather than render blank.
    const jsonOnly = buildGlb(document, new Uint8Array(0));
    const truncated = jsonOnly.subarray(0, jsonOnly.byteLength - 8);
    expect(() => parseGlb(truncated)).toThrow(/chunk/);
  });
});

describe('readAccessor', () => {
  it('reads float attributes at their view offset', () => {
    const { gltf, bin: body } = parseGlb(buildGlb(document, bin));
    expect(Array.from(readAccessor(gltf, body, 0))).toEqual([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  });

  it('reads 32 bit indices, which is what the pipeline writes', () => {
    const { gltf, bin: body } = parseGlb(buildGlb(document, bin));
    expect(Array.from(readAccessor(gltf, body, 1))).toEqual([0, 1, 2]);
  });

  it('refuses a component type it cannot read rather than misreading it', () => {
    const { gltf, bin: body } = parseGlb(buildGlb(document, bin));
    expect(() => readAccessor(gltf, body, 2)).toThrow(/component type/);
  });
});
