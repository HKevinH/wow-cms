/** One display id, from the client's tables to a GLB on disk. */
import { decodeBlp } from './blp';
import type { Dbc } from './dbc';
import { writeGlb } from './gltf';
import { readM2, readSkin } from './m2';
import { encodePng } from './png';
import { resolveArt, type ArtLookup } from './resolve';

/** Field indices in `ItemDisplayInfo.dbc`. A DBC records no column names, so
 *  these were read off the shipped 5.4.8 table: row 1685 gives
 *  `Buckler_Round_A_01.mdx` in field 1 and `Buckler_Round_A_01Purple` in
 *  field 3. Field 2 is a second model slot, used by a handful of displays. */
const FIELD_MODEL = 1;
const FIELD_TEXTURE = 3;

export interface DisplayArt {
  readonly modelName: string;
  readonly textureName: string;
}

export function readDisplayArt(dbc: Dbc, displayId: number): DisplayArt | undefined {
  const row = dbc.rowById(displayId);
  if (row === undefined) return undefined;
  return { modelName: dbc.text(row, FIELD_MODEL), textureName: dbc.text(row, FIELD_TEXTURE) };
}

export interface ListedDisplay extends DisplayArt {
  readonly displayId: number;
}

/** Every display that names a model of its own.
 *
 *  Two thirds of the table is armour drawn onto the body and is left out
 *  here: walking it would report tens of thousands of failures that are not
 *  failures. Of the shipped 75,694 rows, 23,975 come back. */
export function listDisplays(dbc: Dbc): ListedDisplay[] {
  const listed: ListedDisplay[] = [];
  for (let row = 0; row < dbc.recordCount; row += 1) {
    const modelName = dbc.text(row, FIELD_MODEL);
    if (modelName === '') continue;
    listed.push({
      displayId: dbc.uint(row, 0),
      modelName,
      textureName: dbc.text(row, FIELD_TEXTURE),
    });
  }
  return listed;
}

export interface ArtSource extends ArtLookup {
  read(path: string): Uint8Array;
}

export type ConversionOutcome =
  /** Armour drawn as texture on the body. Expected for two thirds of the
   *  table, and not something to report as a failure. */
  | { readonly kind: 'no-model'; readonly displayId: number }
  /** The tables name art the extracted tree does not hold, which normally
   *  means the archive holding it was never extracted. */
  | { readonly kind: 'missing'; readonly displayId: number; readonly modelName: string }
  /** The mesh resolved but nothing textures it. */
  | { readonly kind: 'no-texture'; readonly displayId: number; readonly model: string }
  | {
      readonly kind: 'converted';
      readonly displayId: number;
      readonly glb: Uint8Array;
      readonly vertices: number;
      readonly triangles: number;
    };

export interface ConvertOptions extends DisplayArt {
  readonly displayId: number;
  readonly inventoryType: number;
  readonly source: ArtSource;
  readonly character?: string;
}

export function convertDisplay({
  displayId,
  modelName,
  textureName,
  inventoryType,
  source,
  character,
}: ConvertOptions): ConversionOutcome {
  const art = resolveArt({ modelName, textureName, inventoryType, lookup: source, character });
  if (art.kind === 'no-model') return { kind: 'no-model', displayId };
  if (art.kind === 'missing') return { kind: 'missing', displayId, modelName: art.modelName };
  if (!source.has(art.skin)) {
    return { kind: 'missing', displayId, modelName: art.skin.split('/').pop() ?? art.skin };
  }

  const model = readM2(source.read(art.model));
  const skin = readSkin(source.read(art.skin));

  // The display's own texture wins; a few models instead bake their filename
  // into the M2 and leave the display blank.
  const bakedTexture = model.textures.find((texture) => texture.filename !== '')?.filename;
  const texturePath = art.texture ?? (bakedTexture && source.has(bakedTexture) ? bakedTexture : undefined);
  if (!texturePath) return { kind: 'no-texture', displayId, model: art.model };

  const png = encodePng(decodeBlp(source.read(texturePath)));
  const glb = writeGlb({
    positions: model.positions,
    normals: model.normals,
    uvs: model.uvs,
    indices: skin.indices,
    png,
  });

  return {
    kind: 'converted',
    displayId,
    glb,
    vertices: model.positions.length / 3,
    triangles: skin.indices.length / 3,
  };
}
