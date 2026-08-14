import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { AccountId, Role } from '@wowcms/contracts';
import type { AuthStore, StoredSession } from './auth.service';

/** The CMS database side of identity. Every query here is against a wowcms_
 *  table; the emulator's schema is never touched from this file. */
export class MysqlAuthStore implements AuthStore {
  constructor(private readonly pool: Pool) {}

  async createSession(session: StoredSession): Promise<void> {
    await this.pool.execute(
      `INSERT INTO wowcms_session (token_hash, account_id, username, expires_at)
       VALUES (?, ?, ?, ?)`,
      [session.tokenHash, session.accountId, session.username, session.expiresAt],
    );
  }

  async findSession(tokenHash: string): Promise<StoredSession | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT token_hash, account_id, username, expires_at
       FROM wowcms_session WHERE token_hash = ?`,
      [tokenHash],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      tokenHash: String(row.token_hash),
      accountId: Number(row.account_id),
      username: String(row.username),
      // The pool is created with dateStrings, so this arrives as a string in the
      // server's timezone and is parsed here rather than by the driver.
      expiresAt: new Date(String(row.expires_at).replace(' ', 'T') + 'Z'),
    };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.execute('DELETE FROM wowcms_session WHERE token_hash = ?', [tokenHash]);
  }

  async deleteExpiredSessions(now: Date): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM wowcms_session WHERE expires_at <= ?',
      [now],
    );
    return result.affectedRows;
  }

  async rolesOf(accountId: AccountId): Promise<Role[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT r.id, r.name, r.description, r.permissions
       FROM wowcms_role r
       JOIN wowcms_account_role ar ON ar.role_id = r.id
       WHERE ar.account_id = ?`,
      [accountId],
    );
    return rows.map(toRole);
  }

  async countRoles(): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM wowcms_role',
    );
    return Number(rows[0]?.total ?? 0);
  }

  async createRole(
    name: string,
    description: string,
    permissions: readonly string[],
  ): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO wowcms_role (name, description, permissions) VALUES (?, ?, ?)',
      [name, description, JSON.stringify(permissions)],
    );
    return result.insertId;
  }

  async grantRole(accountId: AccountId, roleId: number): Promise<void> {
    // Granting a role somebody already holds is not an error; it is the same
    // request arriving twice.
    await this.pool.execute(
      `INSERT INTO wowcms_account_role (account_id, role_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE granted_at = granted_at`,
      [accountId, roleId],
    );
  }

  // --- Beyond the AuthStore contract: what the role editor needs. ---

  async listRoles(): Promise<Role[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT id, name, description, permissions FROM wowcms_role ORDER BY name',
    );
    return rows.map(toRole);
  }

  async updateRole(
    id: number,
    description: string,
    permissions: readonly string[],
  ): Promise<void> {
    await this.pool.execute(
      'UPDATE wowcms_role SET description = ?, permissions = ? WHERE id = ?',
      [description, JSON.stringify(permissions), id],
    );
  }

  async deleteRole(id: number): Promise<void> {
    // Grants go with it through the foreign key's ON DELETE CASCADE.
    await this.pool.execute('DELETE FROM wowcms_role WHERE id = ?', [id]);
  }

  async revokeRole(accountId: AccountId, roleId: number): Promise<void> {
    await this.pool.execute(
      'DELETE FROM wowcms_account_role WHERE account_id = ? AND role_id = ?',
      [accountId, roleId],
    );
  }

  async roleNamesOf(accountIds: readonly AccountId[]): Promise<Map<AccountId, string[]>> {
    const byAccount = new Map<AccountId, string[]>();
    if (accountIds.length === 0) return byAccount;

    // One query for the whole page rather than one per row: the accounts list
    // shows fifty at a time and fifty round trips is a slow page for no reason.
    const placeholders = accountIds.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT ar.account_id, r.name
       FROM wowcms_account_role ar
       JOIN wowcms_role r ON r.id = ar.role_id
       WHERE ar.account_id IN (${placeholders})`,
      [...accountIds],
    );

    for (const row of rows) {
      const id = Number(row.account_id);
      byAccount.set(id, [...(byAccount.get(id) ?? []), String(row.name)]);
    }
    return byAccount;
  }
}

function toRole(row: RowDataPacket): Role {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description),
    permissions: parsePermissions(row.permissions),
  };
}

/** Permissions are stored as a JSON array in a TEXT column. A row edited by hand
 *  into something that is not an array should disable that role rather than crash
 *  every request the holder makes. */
function parsePermissions(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
