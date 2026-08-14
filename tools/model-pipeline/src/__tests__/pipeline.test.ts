import { describe, expect, it } from 'vitest';
import { convertDisplay, listDisplays, readDisplayArt } from '../pipeline';
import { readDbc } from '../dbc';
import { buildM2, buildSkin, buildTinyBlp, buildTriangleModel } from './fixtures';

/** An extracted art tree held in memory. Real trees are matched without
 *  regard to case because the client's own casing varies inside one folder. */
function sourceOf(files: Record<string, Uint8Array>) {
  const entries = new Map(Object.entries(files).map(([path, bytes]) => [path.toLowerCase(), bytes]));
  return {
    has: (path: string) => entries.has(path.toLowerCase()),
    read: (path: string) => {
      const found = entries.get(path.toLowerCase());
      if (!found) throw new Error(`missing ${path}`);
      return found;
    },
  };
}

const SHIELD = 'Item/ObjectComponents/Shield';
const triangle = buildTriangleModel();

const shieldFiles = {
  [`${SHIELD}/Buckler_Round_A_01.m2`]: triangle.m2,
  [`${SHIELD}/Buckler_Round_A_0100.skin`]: triangle.skin,
  [`${SHIELD}/Buckler_Round_A_01Purple.blp`]: buildTinyBlp(),
};

const shieldDisplay = {
  displayId: 1685,
  modelName: 'Buckler_Round_A_01.mdx',
  textureName: 'Buckler_Round_A_01Purple',
  inventoryType: 14,
};

describe('readDisplayArt', () => {
  it('reads the model from field 1 and the texture from field 3', () => {
    // Column meaning is not recorded anywhere in a DBC. These two indices
    // were read off the shipped ItemDisplayInfo.dbc, where display 1685
    // gives Buckler_Round_A_01.mdx and Buckler_Round_A_01Purple.
    const bytes = buildItemDisplayInfo();
    expect(readDisplayArt(readDbc(bytes), 1685)).toEqual({
      modelName: 'Buckler_Round_A_01.mdx',
      textureName: 'Buckler_Round_A_01Purple',
    });
  });

  it('reports nothing for a display the table does not hold', () => {
    expect(readDisplayArt(readDbc(buildItemDisplayInfo()), 4242)).toBeUndefined();
  });
});

describe('listDisplays', () => {
  it('yields only the displays that name a model', () => {
    // Two thirds of the shipped table is armour with no model of its own.
    // Walking all 75,694 rows and converting the ones without art would
    // report tens of thousands of failures that are not failures.
    const listed = listDisplays(readDbc(buildItemDisplayInfo()));
    expect(listed).toEqual([
      { displayId: 1685, modelName: 'Buckler_Round_A_01.mdx', textureName: 'Buckler_Round_A_01Purple' },
    ]);
  });
});

describe('convertDisplay', () => {
  it('produces a GLB when the model, skin and texture are all present', () => {
    const outcome = convertDisplay({ ...shieldDisplay, source: sourceOf(shieldFiles) });
    expect(outcome.kind).toBe('converted');
    if (outcome.kind !== 'converted') return;
    expect(outcome.triangles).toBe(1);
    expect(Array.from(outcome.glb.subarray(0, 4))).toEqual([0x67, 0x6c, 0x54, 0x46]);
  });

  it('passes through armour that has no model of its own', () => {
    const outcome = convertDisplay({
      displayId: 11096,
      modelName: '',
      textureName: '',
      inventoryType: 8,
      source: sourceOf({}),
    });
    expect(outcome).toEqual({ kind: 'no-model', displayId: 11096 });
  });

  it('names the file it wanted when the art is not in the tree', () => {
    // Almost always means the MPQ holding it was never extracted, so the
    // message has to carry the filename to act on.
    const outcome = convertDisplay({
      displayId: 124035,
      modelName: 'Axe_2H_PvPPandariaS2_C_01.mdx',
      textureName: '',
      inventoryType: 17,
      source: sourceOf({}),
    });
    expect(outcome).toEqual({
      kind: 'missing',
      displayId: 124035,
      modelName: 'Axe_2H_PvPPandariaS2_C_01.m2',
    });
  });

  it('falls back to the texture baked into the model', () => {
    // Most item textures are replaceable and named by the DBC, but a few
    // models carry their own and leave the display's texture blank.
    const baked = buildM2(
      [
        { position: [0, 0, 0], normal: [0, 0, 1], uv: [0, 0] },
        { position: [1, 0, 0], normal: [0, 0, 1], uv: [1, 0] },
        { position: [0, 1, 0], normal: [0, 0, 1], uv: [0, 1] },
      ],
      { textures: [{ type: 0, filename: 'Item/ObjectComponents/Shield/Baked.blp' }] },
    );
    const outcome = convertDisplay({
      displayId: 1,
      modelName: 'Thing.mdx',
      textureName: '',
      inventoryType: 14,
      source: sourceOf({
        [`${SHIELD}/Thing.m2`]: baked,
        [`${SHIELD}/Thing00.skin`]: buildSkin([0, 1, 2], [0, 1, 2]),
        'Item/ObjectComponents/Shield/Baked.blp': buildTinyBlp(),
      }),
    });
    expect(outcome.kind).toBe('converted');
  });

  it('reports a model it can find but cannot texture', () => {
    const outcome = convertDisplay({
      ...shieldDisplay,
      source: sourceOf({
        [`${SHIELD}/Buckler_Round_A_01.m2`]: triangle.m2,
        [`${SHIELD}/Buckler_Round_A_0100.skin`]: triangle.skin,
      }),
    });
    expect(outcome).toMatchObject({ kind: 'no-texture', displayId: 1685 });
  });

  it('reports a model whose skin profile is absent', () => {
    const outcome = convertDisplay({
      ...shieldDisplay,
      source: sourceOf({ [`${SHIELD}/Buckler_Round_A_01.m2`]: triangle.m2 }),
    });
    expect(outcome.kind).toBe('missing');
  });
});

/** Two rows shaped like the real table: id, model name, then the texture in
 *  field 3, with field 2 the unused second model slot. */
function buildItemDisplayInfo(): Uint8Array {
  const model = 'Buckler_Round_A_01.mdx';
  const texture = 'Buckler_Round_A_01Purple';
  const block = [0];
  const modelOffset = block.length;
  for (const code of Buffer.from(model, 'utf8')) block.push(code);
  block.push(0);
  const textureOffset = block.length;
  for (const code of Buffer.from(texture, 'utf8')) block.push(code);
  block.push(0);

  const rows = [
    [1685, modelOffset, 0, textureOffset, 0],
    [11096, 0, 0, 0, 0],
  ];
  const recordSize = 5 * 4;
  const bytes = new Uint8Array(20 + rows.length * recordSize + block.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x57, 0x44, 0x42, 0x43], 0);
  view.setUint32(4, rows.length, true);
  view.setUint32(8, 5, true);
  view.setUint32(12, recordSize, true);
  view.setUint32(16, block.length, true);
  rows.forEach((row, index) =>
    row.forEach((value, field) => view.setUint32(20 + index * recordSize + field * 4, value, true)),
  );
  bytes.set(block, 20 + rows.length * recordSize);
  return bytes;
}
