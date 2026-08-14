import type { Pool } from 'mysql2/promise';
import type { AccountId, NewAccount } from '@wowcms/contracts';
import type { SchemaProbe } from '../schema-probe';
import type { CoreAdapter } from '../registry';
import type { FieldMap } from '../field-map';
import { shaPassHash } from './password';

const defaultFieldMap: FieldMap = {
  accounts: {
    table: 'account',
    id: 'id',
    username: 'username',
    passwordHash: 'sha_pass_hash',
    email: 'email',
  },
};

/** Wraps an identifier in backticks and rejects anything that is not a plain
 *  identifier, so a field map coming from configuration cannot inject SQL. */
export function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier in field map: ${name}`);
  }
  return `\`${name}\``;
}

export const trinity548Adapter: CoreAdapter = {
  id: 'trinity-5.4.8',
  defaultFieldMap,

  detect(probe: SchemaProbe): number {
    if (!probe.hasTable('account')) return 0;
    // Modern cores replaced the hash column with verifier/salt; this adapter's
    // password rule would be wrong for them, so it declines rather than guesses.
    if (probe.hasColumn('account', 'verifier')) return 0;
    if (!probe.hasColumn('account', 'sha_pass_hash')) return 0;

    let score = 80;
    if (probe.hasColumn('account', 's') && probe.hasColumn('account', 'v')) score += 10;
    if (probe.hasColumn('account', 'battlenet_account')) score += 10;
    return score;
  },
};

export async function createAccount(
  pool: Pool,
  map: FieldMap,
  input: NewAccount,
): Promise<AccountId> {
  const table = quoteIdentifier(map.accounts.table);
  const username = quoteIdentifier(map.accounts.username);
  const hash = quoteIdentifier(map.accounts.passwordHash);
  const email = quoteIdentifier(map.accounts.email);

  const [result] = await pool.execute(
    `INSERT INTO ${table} (${username}, ${hash}, ${email}) VALUES (?, ?, ?)`,
    [input.username.toUpperCase(), shaPassHash(input.username, input.password), input.email],
  );

  return (result as { insertId: number }).insertId;
}

export async function verifyPassword(
  pool: Pool,
  map: FieldMap,
  username: string,
  password: string,
): Promise<AccountId | null> {
  const table = quoteIdentifier(map.accounts.table);
  const idColumn = quoteIdentifier(map.accounts.id);
  const usernameColumn = quoteIdentifier(map.accounts.username);
  const hashColumn = quoteIdentifier(map.accounts.passwordHash);

  const [rows] = await pool.execute(
    `SELECT ${idColumn} AS id FROM ${table} WHERE ${usernameColumn} = ? AND ${hashColumn} = ?`,
    [username.toUpperCase(), shaPassHash(username, password)],
  );

  const found = (rows as Array<{ id: number }>)[0];
  return found ? found.id : null;
}
