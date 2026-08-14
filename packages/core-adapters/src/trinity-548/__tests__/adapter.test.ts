import { describe, expect, it } from 'vitest';
import { SchemaProbe } from '../../schema-probe';
import { trinity548Adapter } from '../adapter';

const fullSchema = new SchemaProbe([
  { table: 'account', column: 'id', type: 'int' },
  { table: 'account', column: 'username', type: 'varchar' },
  { table: 'account', column: 'sha_pass_hash', type: 'varchar' },
  { table: 'account', column: 'email', type: 'varchar' },
]);

describe('trinity548Adapter.detect', () => {
  it('recognises a 5.4.8 auth schema with high confidence', () => {
    expect(trinity548Adapter.detect(fullSchema)).toBeGreaterThanOrEqual(80);
  });

  it('declines a schema with no account table', () => {
    expect(trinity548Adapter.detect(new SchemaProbe([]))).toBe(0);
  });

  it('declines a modern schema that uses verifier instead of sha_pass_hash', () => {
    const modern = new SchemaProbe([
      { table: 'account', column: 'id', type: 'int' },
      { table: 'account', column: 'username', type: 'varchar' },
      { table: 'account', column: 'verifier', type: 'blob' },
      { table: 'account', column: 'salt', type: 'blob' },
    ]);
    expect(trinity548Adapter.detect(modern)).toBe(0);
  });
});
