import { describe, expect, it } from 'vitest';
import { SchemaProbe } from '../schema-probe';
import { applyFieldMapOverrides, type FieldMap } from '../field-map';
import { selectAdapter, type CoreAdapter } from '../registry';

const baseMap: FieldMap = {
  accounts: {
    table: 'account',
    id: 'id',
    username: 'username',
    passwordHash: 'sha_pass_hash',
    email: 'email',
  },
};

const strong: CoreAdapter = { id: 'strong', detect: () => 90, defaultFieldMap: baseMap };
const weak: CoreAdapter = { id: 'weak', detect: () => 10, defaultFieldMap: baseMap };
const absent: CoreAdapter = { id: 'absent', detect: () => 0, defaultFieldMap: baseMap };

const probe = new SchemaProbe([{ table: 'account', column: 'username', type: 'varchar' }]);

describe('selectAdapter', () => {
  it('picks the highest scoring adapter', () => {
    expect(selectAdapter([weak, strong], probe).adapter.id).toBe('strong');
  });

  it('reports the winning score so a weak match is visible', () => {
    expect(selectAdapter([weak, strong], probe).score).toBe(90);
  });

  it('throws when no adapter recognises the schema, naming the problem', () => {
    expect(() => selectAdapter([absent], probe)).toThrow(/no adapter recognised/i);
  });
});

describe('applyFieldMapOverrides', () => {
  it('replaces only the entries given', () => {
    const merged = applyFieldMapOverrides(baseMap, { accounts: { table: 'accounts' } });
    expect(merged.accounts.table).toBe('accounts');
    expect(merged.accounts.username).toBe('username');
  });

  it('leaves the base map untouched', () => {
    applyFieldMapOverrides(baseMap, { accounts: { table: 'accounts' } });
    expect(baseMap.accounts.table).toBe('account');
  });
});
