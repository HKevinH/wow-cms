import { describe, expect, it } from 'vitest';
import { DEFAULT_CHARACTER, resolveArt } from '../resolve';

/** Stands in for the extracted art tree; paths are matched case-insensitively
 *  because the client's own casing is inconsistent even within one folder. */
function lookupOf(...paths: string[]) {
  const known = new Set(paths.map((path) => path.toLowerCase()));
  return { has: (path: string) => known.has(path.toLowerCase()) };
}

const empty = lookupOf();

describe('resolveArt', () => {
  it('reports no model when the display carries no model name', () => {
    // Two thirds of ItemDisplayInfo is armour drawn as texture on the body.
    // That is the normal case, not a failure, and callers must be able to
    // tell it apart from art that is missing.
    const art = resolveArt({ modelName: '', textureName: 'Cloth_Chest', inventoryType: 5, lookup: empty });
    expect(art).toEqual({ kind: 'no-model' });
  });

  it('swaps the .mdx the DBC records for the .m2 on disk', () => {
    // A leftover from Warcraft 3: the table still names models .mdx although
    // no such file has shipped in years.
    const art = resolveArt({
      modelName: 'Sword_2H_Bastard_D_01.mdx',
      textureName: '',
      inventoryType: 17,
      lookup: lookupOf('Item/ObjectComponents/Weapon/Sword_2H_Bastard_D_01.m2'),
    });
    expect(art).toMatchObject({ kind: 'model', model: 'Item/ObjectComponents/Weapon/Sword_2H_Bastard_D_01.m2' });
  });

  it('derives the skin profile from the model name', () => {
    const art = resolveArt({
      modelName: 'Buckler_Round_A_01.mdx',
      textureName: '',
      inventoryType: 14,
      lookup: lookupOf(
        'Item/ObjectComponents/Shield/Buckler_Round_A_01.m2',
        'Item/ObjectComponents/Shield/Buckler_Round_A_0100.skin',
      ),
    });
    expect(art).toMatchObject({ skin: 'Item/ObjectComponents/Shield/Buckler_Round_A_0100.skin' });
  });

  it('appends a race and gender suffix for head slot art', () => {
    // The DBC names one helm; the client ships one model per race and gender.
    const art = resolveArt({
      modelName: 'Helm_Plate_D_01.mdx',
      textureName: '',
      inventoryType: 1,
      lookup: lookupOf('Item/ObjectComponents/Head/Helm_Plate_D_01_HuM.m2'),
    });
    expect(art).toMatchObject({ model: 'Item/ObjectComponents/Head/Helm_Plate_D_01_HuM.m2' });
  });

  it('still finds head art when the inventory slot is unknown', () => {
    // Display ids given on the command line arrive without a slot. The naming
    // rule belongs to the folder the art sits in, not to what the caller
    // happened to know about the item.
    const art = resolveArt({
      modelName: 'Helm_Plate_D_01.mdx',
      textureName: '',
      inventoryType: 0,
      lookup: lookupOf('Item/ObjectComponents/Head/Helm_Plate_D_01_HuM.m2'),
    });
    expect(art).toMatchObject({ model: 'Item/ObjectComponents/Head/Helm_Plate_D_01_HuM.m2' });
  });

  it('still finds shoulder art when the inventory slot is unknown', () => {
    const art = resolveArt({
      modelName: 'Shoulder_Plate_RaidPaladin_A_01.mdx',
      textureName: '',
      inventoryType: 0,
      lookup: lookupOf('Item/ObjectComponents/Shoulder/LShoulder_Plate_RaidPaladin_A_01.m2'),
    });
    expect(art).toMatchObject({
      model: 'Item/ObjectComponents/Shoulder/LShoulder_Plate_RaidPaladin_A_01.m2',
    });
  });

  it('honours a requested race and gender over the default', () => {
    const art = resolveArt({
      modelName: 'Helm_Plate_D_01.mdx',
      textureName: '',
      inventoryType: 1,
      character: 'BeF',
      lookup: lookupOf('Item/ObjectComponents/Head/Helm_Plate_D_01_BeF.m2'),
    });
    expect(art).toMatchObject({ model: 'Item/ObjectComponents/Head/Helm_Plate_D_01_BeF.m2' });
  });

  it('takes the left piece for shoulder art', () => {
    // Shoulders ship as two models the client prefixes L and R; showing one
    // is the honest simplification, showing neither is a bug.
    const art = resolveArt({
      modelName: 'Shoulder_Plate_RaidPaladin_A_01.mdx',
      textureName: '',
      inventoryType: 3,
      lookup: lookupOf('Item/ObjectComponents/Shoulder/LShoulder_Plate_RaidPaladin_A_01.m2'),
    });
    expect(art).toMatchObject({
      model: 'Item/ObjectComponents/Shoulder/LShoulder_Plate_RaidPaladin_A_01.m2',
    });
  });

  it('looks in other folders when the slot folder has nothing', () => {
    // Inventory type maps to a folder only loosely, and a wrong guess would
    // report art missing that is sitting right there.
    const art = resolveArt({
      modelName: 'Misc_Thing_01.mdx',
      textureName: '',
      inventoryType: 13,
      lookup: lookupOf('Item/ObjectComponents/Waist/Misc_Thing_01.m2'),
    });
    expect(art).toMatchObject({ model: 'Item/ObjectComponents/Waist/Misc_Thing_01.m2' });
  });

  it('resolves the texture beside the model it belongs to', () => {
    const art = resolveArt({
      modelName: 'Buckler_Round_A_01.mdx',
      textureName: 'Buckler_Round_A_01Purple',
      inventoryType: 14,
      lookup: lookupOf(
        'Item/ObjectComponents/Shield/Buckler_Round_A_01.m2',
        'Item/ObjectComponents/Shield/Buckler_Round_A_01Purple.blp',
      ),
    });
    expect(art).toMatchObject({ texture: 'Item/ObjectComponents/Shield/Buckler_Round_A_01Purple.blp' });
  });

  it('reports the art missing when no folder holds the model', () => {
    const art = resolveArt({
      modelName: 'Axe_2H_PvPPandariaS2_C_01.mdx',
      textureName: '',
      inventoryType: 17,
      lookup: empty,
    });
    expect(art).toEqual({ kind: 'missing', modelName: 'Axe_2H_PvPPandariaS2_C_01.m2' });
  });

  it('defaults to a human male when no character is named', () => {
    expect(DEFAULT_CHARACTER).toBe('HuM');
  });
});
