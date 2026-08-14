import { describe, expect, it } from 'vitest';
import { readDbc } from '../dbc';

/** Builds a WDBC the way the client writes one: a 20 byte header, fixed size
 *  records, then a string block that the string fields index into. */
function buildDbc(rows: readonly (readonly number[])[], strings: readonly string[]): Uint8Array {
  const fieldCount = rows[0]?.length ?? 0;
  const recordSize = fieldCount * 4;
  const block: number[] = [0]; // offset 0 is the empty string
  const offsets = new Map<string, number>();
  for (const text of strings) {
    offsets.set(text, block.length);
    for (const code of Buffer.from(text, 'utf8')) block.push(code);
    block.push(0);
  }

  const bytes = new Uint8Array(20 + rows.length * recordSize + block.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x57, 0x44, 0x42, 0x43], 0); // 'WDBC'
  view.setUint32(4, rows.length, true);
  view.setUint32(8, fieldCount, true);
  view.setUint32(12, recordSize, true);
  view.setUint32(16, block.length, true);
  rows.forEach((row, index) => {
    row.forEach((value, field) => {
      view.setUint32(20 + index * recordSize + field * 4, value, true);
    });
  });
  bytes.set(block, 20 + rows.length * recordSize);
  return bytes;
}

/** Offsets chosen so 'Buckler_Round_A_01.mdx' sits at 1 and the texture at 24. */
const sample = buildDbc(
  [
    [1685, 1, 0, 24, 0],
    [1129, 0, 0, 0, 0],
  ],
  ['Buckler_Round_A_01.mdx', 'Buckler_Round_A_01Purple'],
);

describe('readDbc', () => {
  it('reads the record and field counts from the header', () => {
    const dbc = readDbc(sample);
    expect(dbc.recordCount).toBe(2);
    expect(dbc.fieldCount).toBe(5);
  });

  it('reads a numeric field', () => {
    expect(readDbc(sample).uint(0, 0)).toBe(1685);
  });

  it('reads a string field through the string block', () => {
    expect(readDbc(sample).text(0, 1)).toBe('Buckler_Round_A_01.mdx');
  });

  it('reads an empty string when the field points at offset zero', () => {
    expect(readDbc(sample).text(1, 1)).toBe('');
  });

  it('finds the row holding an id', () => {
    expect(readDbc(sample).rowById(1129)).toBe(1);
  });

  it('reports no row when the id is absent', () => {
    expect(readDbc(sample).rowById(99999)).toBeUndefined();
  });

  it('rejects a file that is not WDBC', () => {
    // A DBC read out of the wrong folder is the usual cause, and a wrong
    // answer here would be silently wrong rather than loudly broken.
    expect(() => readDbc(new Uint8Array(64))).toThrow(/WDBC/);
  });
});
