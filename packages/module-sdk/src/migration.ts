/** One irreversible step forward in a module's own schema.
 *
 *  Migrations carry a version rather than a filename timestamp so a module's
 *  history is readable in its source, and the platform records
 *  `(moduleId, version)` once applied. There is no `down`: rolling a schema back
 *  in production is a restore, not a script, and offering one invites people to
 *  try it on data they cannot get back. */
export interface Migration {
  /** Monotonic within a module, starting at 1. */
  readonly version: number;
  readonly name: string;
  /** Statements applied in order inside one transaction. Split into an array
   *  rather than one blob because MySQL will not accept multiple statements in a
   *  single prepared call. */
  readonly statements: readonly string[];
}

/** Rejects a history the runner could not apply predictably, at startup, with
 *  the module named. A duplicate or out-of-order version is a mistake somebody
 *  made merging two branches, and it should not be discovered halfway through a
 *  transaction. */
export function assertValidHistory(moduleId: string, migrations: readonly Migration[]): void {
  let previous = 0;
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`Module '${moduleId}': migration versions start at 1.`);
    }
    if (migration.version <= previous) {
      throw new Error(
        `Module '${moduleId}': migration ${migration.version} ('${migration.name}') is not after ${previous}.`,
      );
    }
    if (migration.statements.length === 0) {
      throw new Error(`Module '${moduleId}': migration ${migration.version} has no statements.`);
    }
    previous = migration.version;
  }
}
