import { describe, expect, it } from 'vitest';
import { writeGlb } from '../gltf';

const mesh = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
};

/** Splits the container the way a glTF loader does, so the assertions below
 *  read the same bytes a browser would. */
function parseGlb(glb: Uint8Array): { json: any; bin: Uint8Array; declaredLength: number } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  let cursor = 12;
  let json: unknown;
  // Typed from the array it will hold a slice of, so the empty starting value
  // does not narrow it to a differently backed buffer.
  let bin = glb.subarray(0, 0);
  while (cursor < glb.byteLength) {
    const length = view.getUint32(cursor, true);
    const kind = view.getUint32(cursor + 4, true);
    const body = glb.subarray(cursor + 8, cursor + 8 + length);
    if (kind === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    if (kind === 0x004e4942) bin = body;
    cursor += 8 + length;
  }
  return { json, bin, declaredLength: view.getUint32(8, true) };
}

describe('writeGlb', () => {
  it('opens with the glTF magic and container version 2', () => {
    const view = new DataView(writeGlb(mesh).buffer);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
  });

  it('declares a total length matching the bytes it produced', () => {
    const glb = writeGlb(mesh);
    expect(parseGlb(glb).declaredLength).toBe(glb.byteLength);
  });

  it('pads every chunk to a four byte boundary', () => {
    // An unaligned chunk makes loaders read the next header from the wrong
    // place. The odd-length PNG here is what would expose it.
    const glb = writeGlb(mesh);
    const view = new DataView(glb.buffer);
    let cursor = 12;
    while (cursor < glb.byteLength) {
      const length = view.getUint32(cursor, true);
      expect(length % 4).toBe(0);
      cursor += 8 + length;
    }
    expect(cursor).toBe(glb.byteLength);
  });

  it('wires the primitive to its three attributes and its indices', () => {
    const { json } = parseGlb(writeGlb(mesh));
    const primitive = json.meshes[0].primitives[0];
    expect(Object.keys(primitive.attributes).sort()).toEqual(['NORMAL', 'POSITION', 'TEXCOORD_0']);
    expect(json.accessors[primitive.indices].count).toBe(3);
  });

  it('gives the position accessor the bounds the format requires', () => {
    // min and max are mandatory on POSITION; without them a viewer cannot
    // frame the model and typically renders nothing.
    const { json } = parseGlb(writeGlb(mesh));
    const accessor = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    expect(accessor.min).toEqual([0, 0, 0]);
    expect(accessor.max).toEqual([1, 2, 0]);
  });

  it('embeds the texture as a PNG image inside the binary chunk', () => {
    const { json, bin } = parseGlb(writeGlb(mesh));
    expect(json.images[0].mimeType).toBe('image/png');
    const view = json.bufferViews[json.images[0].bufferView];
    expect(Array.from(bin.subarray(view.byteOffset, view.byteOffset + view.byteLength))).toEqual(
      Array.from(mesh.png),
    );
  });

  it('marks the material double sided', () => {
    // Item art leans on back faces far more than modern assets do; culling
    // them leaves visible holes in cloaks and blades.
    const { json } = parseGlb(writeGlb(mesh));
    expect(json.materials[0].doubleSided).toBe(true);
  });
});
