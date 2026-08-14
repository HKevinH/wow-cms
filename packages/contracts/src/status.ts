/** What the status page and the header badge show. Every field is nullable
 *  except `online`, because the ways of learning these differ per core and a
 *  deployment that cannot answer 'how many players' should say so rather than
 *  show a zero that looks like an empty realm. */
export interface RealmStatus {
  readonly name: string;
  readonly realmlist: string;
  readonly online: boolean;
  readonly playersOnline: number | null;
  readonly uptimeSeconds: number | null;
  readonly players: readonly RealmPlayer[];
  /** ISO 8601. When the platform last managed to ask. */
  readonly checkedAt: string;
}

export interface RealmPlayer {
  readonly name: string;
  readonly level: number | null;
  readonly faction: 'alliance' | 'horde' | 'neutral';
  readonly zone: string;
}

export function formatUptime(seconds: number | null): string | null {
  if (seconds === null) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
