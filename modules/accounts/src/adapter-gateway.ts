import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AccountId, AccountSummary, NewAccount } from '@wowcms/contracts';
import { createAccount, quoteIdentifier, verifyPassword, type FieldMap } from '@wowcms/core-adapters';
import type { AccountGateway } from './accounts.service';

/** The only place this module meets the emulator, and it goes through the
 *  adapter rather than SQL of its own. */
export class AdapterAccountGateway implements AccountGateway {
  constructor(
    private readonly pool: Pool,
    private readonly map: FieldMap,
  ) {}

  create(input: NewAccount): Promise<AccountId> {
    return createAccount(this.pool, this.map, input);
  }

  verify(username: string, password: string): Promise<AccountId | null> {
    return verifyPassword(this.pool, this.map, username, password);
  }

  async findByUsername(username: string): Promise<AccountId | null> {
    const table = quoteIdentifier(this.map.accounts.table);
    const idColumn = quoteIdentifier(this.map.accounts.id);
    const usernameColumn = quoteIdentifier(this.map.accounts.username);

    const [rows] = await this.pool.execute(
      `SELECT ${idColumn} AS id FROM ${table} WHERE ${usernameColumn} = ?`,
      [username.toUpperCase()],
    );

    const found = (rows as Array<{ id: number }>)[0];
    return found ? found.id : null;
  }

  async list(query: { search?: string; field?: 'username' | 'email'; limit: number; offset: number }): Promise<{ items: AccountSummary[]; total: number }> {
    const table = quoteIdentifier(this.map.accounts.table);
    const id = quoteIdentifier(this.map.accounts.id);
    const username = quoteIdentifier(this.map.accounts.username);
    const email = quoteIdentifier(this.map.accounts.email);
    const column = query.field === 'email' ? email : query.field === 'username' ? username : '';
    const where = query.search && column ? `WHERE ${column} LIKE ?` : query.search ? `WHERE ${username} LIKE ? OR ${email} LIKE ?` : '';
    const value = `%${query.search ?? ''}%`;
    const params = query.search && column ? [value] : query.search ? [value, value] : [];
    const limit = Math.trunc(query.limit); const offset = Math.trunc(query.offset);
    const [rows] = await this.pool.execute<(RowDataPacket & { id: number; username: string; email: string | null })[]>(`SELECT ${id} AS id, ${username} AS username, ${email} AS email FROM ${table} ${where} ORDER BY ${username} LIMIT ${limit} OFFSET ${offset}`, params);
    const [countRows] = await this.pool.execute<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM ${table} ${where}`, params);
    return { items: rows.map((row) => ({ id: Number(row.id), username: String(row.username), email: String(row.email ?? ''), roles: [] })), total: Number(countRows[0]?.total ?? 0) };
  }
}
