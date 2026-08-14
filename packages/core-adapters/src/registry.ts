import type { SchemaProbe } from './schema-probe';
import type { FieldMap } from './field-map';

export interface CoreAdapter {
  readonly id: string;
  /** How well this adapter recognises the live schema: 0 means not mine, 100 certain. */
  detect(probe: SchemaProbe): number;
  readonly defaultFieldMap: FieldMap;
}

export interface AdapterSelection {
  readonly adapter: CoreAdapter;
  readonly score: number;
}

/** Picks the best match and reports the score, so a weak guess is visible on the
 *  diagnostics page rather than silently driving every query. */
export function selectAdapter(
  adapters: readonly CoreAdapter[],
  probe: SchemaProbe,
): AdapterSelection {
  let best: AdapterSelection | null = null;

  for (const adapter of adapters) {
    const score = adapter.detect(probe);
    if (score > 0 && (best === null || score > best.score)) {
      best = { adapter, score };
    }
  }

  if (best === null) {
    throw new Error(
      'No adapter recognised the emulator schema. Check the database credentials point at ' +
        'an auth database, or add an adapter for this core.',
    );
  }

  return best;
}
