/** Where the emulator keeps things. Adapters ship defaults; deployments override
 *  individual entries from configuration when their schema has drifted, so a
 *  patched server needs a config edit rather than a fork. */
export interface FieldMap {
  readonly accounts: {
    readonly table: string;
    readonly id: string;
    readonly username: string;
    readonly passwordHash: string;
    readonly email: string;
  };
}

export type FieldMapOverrides = {
  readonly [S in keyof FieldMap]?: Partial<FieldMap[S]>;
};

export function applyFieldMapOverrides(base: FieldMap, overrides: FieldMapOverrides): FieldMap {
  return {
    accounts: { ...base.accounts, ...overrides.accounts },
  };
}
