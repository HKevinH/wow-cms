export interface ColumnRecord {
  readonly table: string;
  readonly column: string;
  readonly type: string;
}

/** Answers what a live database actually contains. Built once at startup so no
 *  request pays for introspection, and so a missing column is reported then
 *  rather than discovered by whoever opens the wrong page months later. */
export class SchemaProbe {
  private readonly columns = new Map<string, string>();
  private readonly tables = new Set<string>();

  constructor(records: readonly ColumnRecord[]) {
    for (const record of records) {
      this.tables.add(record.table.toLowerCase());
      this.columns.set(SchemaProbe.key(record.table, record.column), record.type.toLowerCase());
    }
  }

  private static key(table: string, column: string): string {
    return `${table.toLowerCase()}.${column.toLowerCase()}`;
  }

  hasTable(table: string): boolean {
    return this.tables.has(table.toLowerCase());
  }

  hasColumn(table: string, column: string): boolean {
    return this.columns.has(SchemaProbe.key(table, column));
  }

  columnType(table: string, column: string): string | null {
    return this.columns.get(SchemaProbe.key(table, column)) ?? null;
  }
}

/** Minimal shape of a mysql2 connection, so tests need no live database. */
export interface QueryableConnection {
  query(sql: string, values: unknown[]): Promise<[unknown[], unknown]>;
}

export async function buildSchemaProbe(
  connection: QueryableConnection,
  databaseName: string,
): Promise<SchemaProbe> {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS d ' +
      'FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?',
    [databaseName],
  );

  const records = (rows as Array<{ t: string; c: string; d: string }>).map((row) => ({
    table: row.t,
    column: row.c,
    type: row.d,
  }));

  return new SchemaProbe(records);
}
