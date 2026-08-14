/** Turns what `ItemDisplayInfo` records into paths in the extracted art tree.
 *
 *  The table gives a bare filename and nothing else, so the folder has to be
 *  inferred from the item's inventory slot, and two slots need the name itself
 *  rewritten before anything is found on disk. */

/** Folder names as they appear under `Item\ObjectComponents`, in the order
 *  worth trying when the slot mapping comes up empty. Head dwarfs the rest —
 *  eleven thousand models against under two thousand weapons — because it
 *  holds one file per race and gender. */
const FOLDERS = [
  'Weapon',
  'Shield',
  'Head',
  'Shoulder',
  'Waist',
  'Ammo',
  'Quiver',
  'BattleStandards',
  'Scroll',
  'Backpack',
] as const;

const ROOT = 'Item/ObjectComponents';

/** Human male: the most common art in the client and a neutral default for a
 *  storefront that shows one model rather than the shopper's own character. */
export const DEFAULT_CHARACTER = 'HuM';

const HEAD = 1;
const SHOULDER = 3;

/** Inventory type to folder. Weapons cover many slots; anything unmapped
 *  falls through to the search over every folder. */
const SLOT_FOLDER = new Map<number, (typeof FOLDERS)[number]>([
  [HEAD, 'Head'],
  [SHOULDER, 'Shoulder'],
  [6, 'Waist'],
  [13, 'Weapon'],
  [14, 'Shield'],
  [15, 'Weapon'],
  [17, 'Weapon'],
  [21, 'Weapon'],
  [22, 'Weapon'],
  [23, 'Shield'],
  [24, 'Ammo'],
  [25, 'Weapon'],
  [26, 'Weapon'],
  [28, 'Weapon'],
]);

export interface ArtLookup {
  /** True when the extracted tree holds this path, ignoring case. */
  has(path: string): boolean;
}

export interface ResolveOptions {
  /** `modelName` as the DBC records it, extension included. */
  readonly modelName: string;
  readonly textureName: string;
  readonly inventoryType: number;
  readonly lookup: ArtLookup;
  /** Race and gender code for head art, such as `HuM` or `BeF`. */
  readonly character?: string;
}

export type ResolvedArt =
  /** The display is armour drawn onto the body: expected, not an error. */
  | { readonly kind: 'no-model' }
  /** The display names a model the extracted tree does not hold. */
  | { readonly kind: 'missing'; readonly modelName: string }
  | {
      readonly kind: 'model';
      readonly model: string;
      readonly skin: string;
      /** Undefined when the display names no replacement texture, in which
       *  case the model's own baked filename applies. */
      readonly texture: string | undefined;
    };

/** Strips the `.mdx` the table still records; the shipped file is `.m2`. */
function stemOf(modelName: string): string {
  return modelName.replace(/\.(mdx|m2)$/i, '');
}

/** How a folder spells the name the display recorded.
 *
 *  The rule belongs to the folder rather than to the item's slot: a display id
 *  given on the command line arrives with no slot at all, and head art would
 *  then never be found. */
function candidateStems(stem: string, folder: string, character: string): string[] {
  // One model per race and gender, so a helmet is shown on one of them.
  if (folder === 'Head') return [`${stem}_${character}`, stem];
  // Shoulders ship as a left and a right model; the left one stands in for
  // the pair rather than showing nothing.
  if (folder === 'Shoulder') return [`L${stem}`, stem, `R${stem}`];
  return [stem];
}

function foldersFor(inventoryType: number): string[] {
  const preferred = SLOT_FOLDER.get(inventoryType);
  if (!preferred) return [...FOLDERS];
  return [preferred, ...FOLDERS.filter((folder) => folder !== preferred)];
}

export function resolveArt({
  modelName,
  textureName,
  inventoryType,
  lookup,
  character = DEFAULT_CHARACTER,
}: ResolveOptions): ResolvedArt {
  if (modelName.trim() === '') return { kind: 'no-model' };

  const stem = stemOf(modelName);
  for (const folder of foldersFor(inventoryType)) {
    for (const candidate of candidateStems(stem, folder, character)) {
      const model = `${ROOT}/${folder}/${candidate}.m2`;
      if (!lookup.has(model)) continue;
      const texture = textureName.trim() === '' ? undefined : `${ROOT}/${folder}/${textureName}.blp`;
      return {
        kind: 'model',
        model,
        // The client appends the profile number to the model's own name.
        skin: `${ROOT}/${folder}/${candidate}00.skin`,
        texture: texture && lookup.has(texture) ? texture : undefined,
      };
    }
  }

  return { kind: 'missing', modelName: `${stem}.m2` };
}
