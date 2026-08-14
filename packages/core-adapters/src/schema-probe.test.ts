import { describe, expect, it } from 'vitest';
import { SchemaProbe } from './schema-probe';

describe('SchemaProbe', () => {
  const probe = new SchemaProbe([
    { table: 'account', column: 'username', type: 'varchar' },
    { table: 'account', column: 'sha_pass_hash', type: 'varchar' },
  ]);

  it('reports tables it saw', () => {
    expect(probe.hasTable('account')).toBe(true);
    expect(probe.hasTable('battlenet_accounts')).toBe(false);
  });

  it('reports columns it saw', () => {
    expect(probe.hasColumn('account', 'sha_pass_hash')).toBe(true);
    expect(probe.hasColumn('account', 'verifier')).toBe(false);
  });

  it('is case-insensitive, because MySQL identifiers may differ in case', () => {
    expect(probe.hasColumn('ACCOUNT', 'Sha_Pass_Hash')).toBe(true);
  });

  it('returns the column type, or null when absent', () => {
    expect(probe.columnType('account', 'username')).toBe('varchar');
    expect(probe.columnType('account', 'verifier')).toBeNull();
  });
});
