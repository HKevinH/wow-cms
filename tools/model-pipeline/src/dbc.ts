/** Reader for the client's WDBC tables.
 *
 *  Only what resolving an item's art needs: numeric fields, string fields and
 *  a lookup by id. Field *meaning* is not encoded here — a DBC carries no
 *  column names, so callers name the indices they use and say where they
 *  checked them. */

const MAGIC = 0x43424457; // 'WDBC' little-endian
const HEADER_SIZE = 20;

export interface Dbc {
  readonly recordCount: number;
  readonly fieldCount: number;
  /** Reads field `field` of row `row` as an unsigned 32 bit integer. */
  uint(row: number, field: number): number;
  /** Reads a string field, following its offset into the string block. */
  text(row: number, field: number): string;
  /** Row index holding `id` in field 0, or undefined when absent. */
  rowById(id: number): number | undefined;
}

export function readDbc(bytes: Uint8Array): Dbc {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEADER_SIZE || view.getUint32(0, true) !== MAGIC) {
    throw new Error('not a WDBC file: wrong magic in the first four bytes');
  }

  const recordCount = view.getUint32(4, true);
  const fieldCount = view.getUint32(8, true);
  const recordSize = view.getUint32(12, true);
  const stringSize = view.getUint32(16, true);
  const stringStart = HEADER_SIZE + recordCount * recordSize;
  const strings = bytes.subarray(stringStart, stringStart + stringSize);

  const decoder = new TextDecoder('utf-8');

  const uint = (row: number, field: number): number =>
    view.getUint32(HEADER_SIZE + row * recordSize + field * 4, true);

  return {
    recordCount,
    fieldCount,
    uint,
    text(row, field) {
      const offset = uint(row, field);
      if (offset === 0 || offset >= strings.byteLength) return '';
      let end = offset;
      while (end < strings.byteLength && strings[end] !== 0) end += 1;
      return decoder.decode(strings.subarray(offset, end));
    },
    rowById(id) {
      for (let row = 0; row < recordCount; row += 1) {
        if (uint(row, 0) === id) return row;
      }
      return undefined;
    },
  };
}
