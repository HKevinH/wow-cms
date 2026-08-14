import { createPool, type Pool } from 'mysql2/promise';

/** The CMS's own database, separate from the emulator's.
 *
 *  The emulator's schema belongs to the emulator: it is replaced wholesale on
 *  every core upgrade, and anything the CMS added to it is lost or in the way.
 *  So the CMS keeps its own, and the only tables it ever writes outside it are
 *  the account rows the adapter owns. */

/** Larger than the emulator pool: nothing here competes with the worldserver, and
 *  the admin dashboard issues several queries per page. */
export const CMS_POOL_LIMIT = 10;

export function createCmsPool(url: string): Pool {
  return createPool({
    uri: url,
    connectionLimit: CMS_POOL_LIMIT,
    namedPlaceholders: false,
    // Timestamps come back as strings and are converted at the edge. Letting the
    // driver build Date objects means the API's timezone silently decides what a
    // publication date means.
    dateStrings: true,
  });
}

/** The database name from a connection URL, which the migration runner needs to
 *  report what it is about to change. */
export function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}
