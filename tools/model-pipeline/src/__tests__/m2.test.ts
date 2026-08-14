import { describe, expect, it } from 'vitest';
import { readM2, readSkin } from '../m2';
import { buildM2, buildSkin } from './fixtures';

/** Compares componentwise: negating a zero coordinate yields -0, which is the
 *  same number but a different value to a strict comparison. */
function expectVector(actual: Float32Array, expected: readonly number[]): void {
  expect(Array.from(actual)).toHaveLength(expected.length);
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 6));
}

describe('readM2', () => {
  it('rejects a file that is not MD20', () => {
    expect(() => readM2(new Uint8Array(64))).toThrow(/MD20/);
  });

  it('reads the version and the internal model name', () => {
    const model = readM2(buildM2([], { version: 272, name: 'Buckler_Round_A_01' }));
    expect(model.version).toBe(272);
    expect(model.name).toBe('Buckler_Round_A_01');
  });

  it('turns the game axes into glTF axes', () => {
    // The client is Z-up with X forward and Y left; glTF is Y-up with X right.
    // Mapping (x,y,z) to (-y,z,-x) keeps the determinant positive, so winding
    // survives and triangles do not need flipping.
    const model = readM2(buildM2([{ position: [1, 2, 3], normal: [0, 1, 0], uv: [0, 0] }]));
    expectVector(model.positions, [-2, 3, -1]);
    expectVector(model.normals, [-1, 0, 0]);
  });

  it('keeps texture coordinates as they are', () => {
    // Verified against real art: the shield renders right way up without a flip.
    const model = readM2(buildM2([{ position: [0, 0, 0], normal: [0, 0, 1], uv: [0.25, 0.75] }]));
    expect(Array.from(model.uvs)).toEqual([0.25, 0.75]);
  });

  it('reads texture slots with their replaceable type', () => {
    const model = readM2(
      buildM2([], { textures: [{ type: 2, filename: '' }, { type: 0, filename: 'Hardcoded.blp' }] }),
    );
    expect(model.textures).toEqual([
      { type: 2, filename: '' },
      { type: 0, filename: 'Hardcoded.blp' },
    ]);
  });
});

describe('readSkin', () => {
  it('rejects a file that is not SKIN', () => {
    expect(() => readSkin(new Uint8Array(64))).toThrow(/SKIN/);
  });

  it('resolves triangles through the lookup table', () => {
    // The triangle array indexes the lookup array, which in turn indexes the
    // model's vertices. Reading it as vertex indices directly is the classic
    // way to get a mesh that is subtly, silently wrong.
    const skin = buildSkin([7, 8, 9], [2, 1, 0]);
    expect(Array.from(readSkin(skin).indices)).toEqual([9, 8, 7]);
  });

  it('reports how many submeshes the skin declares', () => {
    expect(readSkin(buildSkin([0], [0], 3)).submeshCount).toBe(3);
  });
});
