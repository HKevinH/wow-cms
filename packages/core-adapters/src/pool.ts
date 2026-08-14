import { createPool, type Pool } from 'mysql2/promise';

/** The worldserver is using these databases while the site queries them, so the
 *  site gets a small pool of its own. If the website saturates it the website
 *  stalls, which is survivable; starving the game server is not. */
export const EMULATOR_POOL_LIMIT = 5;

export function createEmulatorPool(url: string): Pool {
  return createPool({ uri: url, connectionLimit: EMULATOR_POOL_LIMIT, namedPlaceholders: false });
}
