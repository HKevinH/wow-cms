import { describe, expect, it } from 'vitest';
import { es } from '../es';
import { en } from '../en';
import {
  DEFAULT_LOCALE,
  LOCALES,
  ROUTES,
  localeFromPath,
  path,
  postPath,
  translatePath,
  useTranslations,
} from '../index';

describe('dictionaries', () => {
  it('translates every key in every locale', () => {
    // The type system already enforces this at build time; the test catches the
    // case the types cannot see - a key present but left as an empty string.
    for (const locale of LOCALES) {
      const t = useTranslations(locale);
      for (const key of Object.keys(es) as (keyof typeof es)[]) {
        expect(t(key), `${locale}: ${key}`).toBeTruthy();
      }
    }
  });

  it('does not leave English strings sitting in the Spanish dictionary', () => {
    // Proper nouns are the same in both languages on purpose; everything else
    // being identical means somebody copied the file and stopped.
    const properNouns = new Set<keyof typeof es>(['hero.eyebrow']);

    const identical = (Object.keys(es) as (keyof typeof es)[]).filter(
      (key) => !properNouns.has(key) && es[key] === en[key] && es[key].split(' ').length > 2,
    );
    expect(identical).toEqual([]);
  });
});

describe('routes', () => {
  it('gives every route a distinct path per locale', () => {
    for (const locale of LOCALES) {
      const paths = Object.values(ROUTES).map((routes) => routes[locale]);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it('serves the default locale from the root and prefixes the others', () => {
    expect(path('home', DEFAULT_LOCALE)).toBe('/');
    expect(path('news', 'en').startsWith('/en/')).toBe(true);
  });
});

describe('localeFromPath', () => {
  it('reads the prefix', () => {
    expect(localeFromPath('/en/news')).toBe('en');
    expect(localeFromPath('/noticias')).toBe('es');
    expect(localeFromPath('/')).toBe('es');
  });

  it('treats an unknown prefix as the default locale', () => {
    expect(localeFromPath('/de/nachrichten')).toBe(DEFAULT_LOCALE);
  });
});

describe('translatePath', () => {
  it('maps a known route to its counterpart', () => {
    expect(translatePath('/noticias', 'en')).toBe('/en/news');
    expect(translatePath('/en/connect', 'es')).toBe('/como-conectar');
  });

  it('ignores a trailing slash', () => {
    expect(translatePath('/noticias/', 'en')).toBe('/en/news');
  });

  it('keeps the slug when translating a post', () => {
    expect(translatePath(postPath('el-reino-abre', 'es'), 'en')).toBe('/en/news/el-reino-abre');
  });

  it('falls back to the front page rather than a dead link', () => {
    expect(translatePath('/algo/que/no/existe', 'en')).toBe('/en');
  });
});
