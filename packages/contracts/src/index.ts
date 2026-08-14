/** Bumped when a breaking change reaches the shared types, so a launcher built
 *  against an older API can refuse to start instead of misbehaving. */
export const CONTRACTS_VERSION = '1.0.0';

/** Capabilities a core may or may not offer. A module declares what it needs and
 *  the platform refuses to start it when the detected core lacks it. */
export const ADAPTER_CAPABILITIES = ['accounts', 'characters', 'guilds', 'items'] as const;

export type AdapterCapability = (typeof ADAPTER_CAPABILITIES)[number];

export type AccountId = number;

export interface NewAccount {
  readonly username: string;
  readonly password: string;
  readonly email: string;
}

/** What the diagnostics page shows: which adapter won, how sure it was, and what
 *  that leaves working. */
export interface AdapterReport {
  readonly adapterId: string;
  readonly score: number;
  readonly capabilities: readonly AdapterCapability[];
  readonly missing: readonly string[];
}
