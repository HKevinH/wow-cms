import { assertValidHistory, type Migration, type WowCmsModule } from '@wowcms/module-sdk';

/** The narrow slice of a database connection the runner needs. Declared here
 *  rather than imported from mysql2 so the runner can be tested against a fake
 *  and so a future adapter for another driver has a target to implement. */
export interface MigrationConnection {
  execute(sql: string, values?: readonly unknown[]): Promise<unknown>;
  query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface AppliedMigration {
  readonly moduleId: string;
  readonly version: number;
}

export interface MigrationResult {
  readonly applied: readonly AppliedMigration[];
  readonly alreadyApplied: number;
}

/** The runner's own bookkeeping table. Created before anything else, and by the
 *  runner rather than by a module, because a module cannot record that it ran
 *  until somewhere exists to record it. */
const LEDGER = `
  CREATE TABLE IF NOT EXISTS wowcms_migration (
    module_id   VARCHAR(64)  NOT NULL,
    version     INT UNSIGNED NOT NULL,
    name        VARCHAR(128) NOT NULL,
    applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (module_id, version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

async function appliedVersions(
  connection: MigrationConnection,
  moduleId: string,
): Promise<Set<number>> {
  const [rows] = await connection.query(
    'SELECT version FROM wowcms_migration WHERE module_id = ?',
    [moduleId],
  );
  return new Set((rows as { version: number }[]).map((row) => row.version));
}

/** Applies one migration, or throws having changed nothing.
 *
 *  MySQL commits implicitly on DDL, so a CREATE TABLE inside a transaction is not
 *  actually rolled back by the rollback below. The transaction still earns its
 *  place: it makes the ledger insert and any DML atomic, and the failure is
 *  reported with the module, version and statement attached, which is what
 *  someone fixing a half-applied schema by hand needs to know. */
async function applyOne(
  connection: MigrationConnection,
  moduleId: string,
  migration: Migration,
): Promise<void> {
  await connection.beginTransaction();
  try {
    for (const statement of migration.statements) {
      await connection.execute(statement);
    }
    await connection.execute(
      'INSERT INTO wowcms_migration (module_id, version, name) VALUES (?, ?, ?)',
      [moduleId, migration.version, migration.name],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Migration ${migration.version} ('${migration.name}') of module '${moduleId}' failed: ${reason}`,
    );
  }
}

/** Brings the CMS database up to date with the enabled modules.
 *
 *  Run at startup, before the first request. A module whose schema is behind is
 *  not a condition to discover on the page that first queries it. */
export async function runMigrations(
  connection: MigrationConnection,
  modules: readonly WowCmsModule[],
): Promise<MigrationResult> {
  await connection.execute(LEDGER);

  const applied: AppliedMigration[] = [];
  let alreadyApplied = 0;

  for (const module of modules) {
    const migrations = module.migrations ?? [];
    if (migrations.length === 0) continue;

    // Validated before anything is applied, so a module with a broken history
    // cannot get halfway through it first.
    assertValidHistory(module.id, migrations);

    const done = await appliedVersions(connection, module.id);

    for (const migration of migrations) {
      if (done.has(migration.version)) {
        alreadyApplied += 1;
        continue;
      }
      await applyOne(connection, module.id, migration);
      applied.push({ moduleId: module.id, version: migration.version });
    }
  }

  return { applied, alreadyApplied };
}
