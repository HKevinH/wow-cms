import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify } from './content';

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('El reino ya está abierto')).toBe('el-reino-ya-esta-abierto');
  });

  it('strips accents rather than the letters carrying them', () => {
    // The regex works on the combining marks NFD produces; getting this wrong
    // turns 'añoranza' into 'anoranza' or, worse, 'aoranza'.
    expect(slugify('Añoranza de Pandaria')).toBe('anoranza-de-pandaria');
    expect(slugify('¿Qué hay de nuevo?')).toBe('que-hay-de-nuevo');
  });

  it('collapses punctuation and trims the hyphens it leaves behind', () => {
    expect(slugify('  ¡Parche 5.4.8 — notas!  ')).toBe('parche-5-4-8-notas');
  });

  it('produces something a URL can carry, for every input', () => {
    for (const input of ['Ñ', '日本語', '---', 'a'.repeat(200)]) {
      const slug = slugify(input);
      expect(slug).toBe(encodeURIComponent(slug));
      expect(slug.length).toBeLessThanOrEqual(96);
    }
  });
});

describe('isValidSlug', () => {
  it('accepts what slugify produces', () => {
    for (const input of ['El reino abre', 'Notas del parche 5.4.8', 'Pet battles']) {
      expect(isValidSlug(slugify(input)), input).toBe(true);
    }
  });

  it('rejects leading, trailing and doubled hyphens', () => {
    expect(isValidSlug('-abre')).toBe(false);
    expect(isValidSlug('abre-')).toBe(false);
    expect(isValidSlug('abre--ya')).toBe(false);
  });

  it('rejects uppercase and anything not ASCII', () => {
    expect(isValidSlug('El-Reino')).toBe(false);
    expect(isValidSlug('añoranza')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});
