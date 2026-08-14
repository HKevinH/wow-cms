import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Migration, WowCmsModule } from '@wowcms/module-sdk';
import { runMigrations, type MigrationConnection } from '../migrations';

/** A connection that records what it was asked to do and answers the ledger
 *  query from a set the test controls. Enough to check ordering, idempotency and
 *  failure handling without a MySQL to talk to. */
class FakeConnection implements MigrationConnection {
  readonly executed: string[] = [];
  readonly commits: number[] = [];
  rollbacks = 0;
  applied = new Set<string>();
  failOn: string | null = null;

  async execute(sql: string, values: readonly unknown[] = []): Promise<unknown> {
    if (this.failOn !== null && sql.includes(this.failOn)) {
      throw new Error('table already exists');
    }
    this.executed.push(sql.trim().split('\n')[0]!.trim());
    if (sql.startsWith('INSERT INTO wowcms_migration')) {
      this.applied.add(`${String(values[0])}:${String(values[1])}`);
    }
    return {};
  }

  async query(_sql: string, values: readonly unknown[] = []): Promise<[unknown, unknown]> {
    const moduleId = String(values[0]);
    const rows = [...this.applied]
      .filter((entry) => entry.startsWith(`${moduleId}:`))
      .map((entry) => ({ version: Number(entry.split(':')[1]) }));
    return [rows, undefined];
  }

  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {
    this.commits.push(this.executed.length);
  }
  async rollback(): Promise<void> {
    this.rollbacks += 1;
  }
}

const migration = (version: number, statement: string): Migration => ({
  version,
  name: `step-${version}`,
  statements: [statement],
});

const moduleWith = (id: string, migrations: Migration[]): WowCmsModule => ({
  id,
  version: '1.0.0',
  migrations,
});

let connection: FakeConnection;

beforeEach(() => {
  connection = new FakeConnection();
});

describe('runMigrations', () => {
  it('creates its ledger before applying anything', async () => {
    await runMigrations(connection, [moduleWith('content', [migration(1, 'CREATE TABLE a (id INT)')])]);
    expect(connection.executed[0]).toContain('CREATE TABLE IF NOT EXISTS wowcms_migration');
  });

  it('applies a module’s migrations in version order', async () => {
    const result = await runMigrations(connection, [
      moduleWith('content', [
        migration(1, 'CREATE TABLE content_post (id INT)'),
        migration(2, 'ALTER TABLE content_post ADD slug VARCHAR(96)'),
      ]),
    ]);

    expect(result.applied).toEqual([
      { moduleId: 'content', version: 1 },
      { moduleId: 'content', version: 2 },
    ]);
    expect(connection.executed).toContain('CREATE TABLE content_post (id INT)');
  });

  it('is idempotent: a second run applies nothing', async () => {
    const modules = [moduleWith('content', [migration(1, 'CREATE TABLE content_post (id INT)')])];

    await runMigrations(connection, modules);
    const second = await runMigrations(connection, modules);

    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toBe(1);
  });

  it('applies only the migrations added since the last run', async () => {
    await runMigrations(connection, [moduleWith('content', [migration(1, 'CREATE TABLE a (id INT)')])]);

    const second = await runMigrations(connection, [
      moduleWith('content', [migration(1, 'CREATE TABLE a (id INT)'), migration(2, 'CREATE TABLE b (id INT)')]),
    ]);

    expect(second.applied).toEqual([{ moduleId: 'content', version: 2 }]);
  });

  it('keeps each module’s history separate', async () => {
    // Both modules number their first migration 1; neither may see the other's.
    const result = await runMigrations(connection, [
      moduleWith('content', [migration(1, 'CREATE TABLE content_post (id INT)')]),
      moduleWith('media', [migration(1, 'CREATE TABLE media_asset (id INT)')]),
    ]);

    expect(result.applied).toEqual([
      { moduleId: 'content', version: 1 },
      { moduleId: 'media', version: 1 },
    ]);
  });

  it('skips a module that declares no migrations', async () => {
    const result = await runMigrations(connection, [{ id: 'status', version: '1.0.0' }]);
    expect(result.applied).toEqual([]);
  });

  it('rolls back and names the failing migration', async () => {
    connection.failOn = 'CREATE TABLE content_post';

    await expect(
      runMigrations(connection, [moduleWith('content', [migration(1, 'CREATE TABLE content_post (id INT)')])]),
    ).rejects.toThrow(/Migration 1 \('step-1'\) of module 'content' failed/);

    expect(connection.rollbacks).toBe(1);
  });

  it('refuses a broken history before touching the database', async () => {
    const before = connection.executed.length;

    await expect(
      runMigrations(connection, [
        moduleWith('content', [migration(2, 'CREATE TABLE a (id INT)'), migration(1, 'CREATE TABLE b (id INT)')]),
      ]),
    ).rejects.toThrow(/not after/);

    // Only the ledger creation ran; no module statement was attempted.
    expect(connection.executed.length).toBe(before + 1);
  });

  it('stops at the first failure rather than continuing to the next module', async () => {
    connection.failOn = 'CREATE TABLE media_asset';
    const spy = vi.spyOn(connection, 'execute');

    await expect(
      runMigrations(connection, [
        moduleWith('media', [migration(1, 'CREATE TABLE media_asset (id INT)')]),
        moduleWith('content', [migration(1, 'CREATE TABLE content_post (id INT)')]),
      ]),
    ).rejects.toThrow(/media/);

    expect(spy.mock.calls.some(([sql]) => String(sql).includes('content_post'))).toBe(false);
  });
});
