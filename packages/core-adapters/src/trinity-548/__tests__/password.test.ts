import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeForHash, shaPassHash } from '../password';

describe('normalizeForHash', () => {
  it('uppercases ASCII letters', () => {
    expect(normalizeForHash('Player')).toBe('PLAYER');
  });

  it('leaves non-Latin characters alone, matching wcharToUpperOnlyLatin', () => {
    // toUpperCase() would return 'ИГРОК' here and produce a different hash.
    expect(normalizeForHash('игрок')).toBe('игрок');
  });

  it('leaves accented Latin-1 characters alone', () => {
    expect(normalizeForHash('café')).toBe('CAFé');
  });

  it('leaves digits and punctuation untouched', () => {
    expect(normalizeForHash('user_01')).toBe('USER_01');
  });
});

describe('shaPassHash', () => {
  it('hashes uppercased USERNAME:PASSWORD as 40 lowercase hex characters', () => {
    const expected = createHash('sha1').update('TEST:SECRET', 'utf8').digest('hex');
    expect(shaPassHash('test', 'secret')).toBe(expected);
    expect(shaPassHash('test', 'secret')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is case-insensitive for both username and password', () => {
    expect(shaPassHash('Test', 'Secret')).toBe(shaPassHash('TEST', 'SECRET'));
  });
});
