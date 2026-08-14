import type { Pool } from 'mysql2/promise';
import type { AccountId, NewAccount } from '@wowcms/contracts';
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
}
