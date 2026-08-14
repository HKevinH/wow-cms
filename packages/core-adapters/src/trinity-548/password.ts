import { createHash } from 'node:crypto';

/** Reproduces AccountMgr::normalizeString, which uppercases through
 *  wcharToUpperOnlyLatin - and that helper changes only basic Latin letters.
 *  String.prototype.toUpperCase() would also fold Cyrillic and accented
 *  characters, producing a hash the emulator never accepts. */
export function normalizeForHash(value: string): string {
  return value.replace(/[a-z]/g, (character) => character.toUpperCase());
}

/** Reproduces AccountMgr::CalculateShaPassHash for TrinityCore 5.4.8:
 *  SHA1 over the UTF-8 bytes of "USERNAME:PASSWORD", as 40 lowercase hex. */
export function shaPassHash(username: string, password: string): string {
  const material = `${normalizeForHash(username)}:${normalizeForHash(password)}`;
  return createHash('sha1').update(material, 'utf8').digest('hex');
}
