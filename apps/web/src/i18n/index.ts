import { es, type TranslationKey } from './es';
import { en } from './en';

export type { TranslationKey };

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Spanish is served from the root; other locales are prefixed. Changing which
 *  locale is the default is this constant plus moving the page files, and
 *  nothing else, because every path in the site comes from the table below. */
export const DEFAULT_LOCALE: Locale = 'es';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { es, en };

/** How each locale names itself, for the switcher. Never translated — a reader
 *  looking for their language reads it in their language. */
export const LOCALE_LABELS: Record<Locale, string> = { es: 'Español', en: 'English' };

/** Every path the site publishes, per locale. Pages and components ask this
 *  table rather than writing a string, so a renamed route cannot leave a dead
 *  link behind in one language and not the other. */
export const ROUTES = {
  home: { es: '/', en: '/en' },
  news: { es: '/noticias', en: '/en/news' },
  connect: { es: '/como-conectar', en: '/en/connect' },
  status: { es: '/estado', en: '/en/status' },
  register: { es: '/registro', en: '/en/register' },
  login: { es: '/entrar', en: '/en/login' },
  account: { es: '/cuenta', en: '/en/account' },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteName = keyof typeof ROUTES;

export function path(name: RouteName, locale: Locale): string {
  return ROUTES[name][locale];
}

/** A post's canonical URL. Slugs are not translated: a post exists in one locale
 *  and is listed under that locale's news index. */
export function postPath(slug: string, locale: Locale): string {
  return `${ROUTES.news[locale]}/${slug}`;
}

/** Which locale a request is in, decided by the prefix. Anything unprefixed is
 *  the default, which is also what makes 404s render in Spanish. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return LOCALES.includes(first as Locale) && first !== DEFAULT_LOCALE ? (first as Locale) : DEFAULT_LOCALE;
}

/** The same page in another locale, for the language switcher. Falls back to that
 *  locale's front page when the current path is not one of the known routes —
 *  better than switching language and landing on a 404. */
export function translatePath(pathname: string, target: Locale): string {
  const normalised = pathname.replace(/\/+$/, '') || '/';
  const current = localeFromPath(normalised);

  for (const routes of Object.values(ROUTES)) {
    if (routes[current] === normalised) return routes[target];
  }

  // News posts keep their slug; the index prefix is what changes.
  const newsPrefix = ROUTES.news[current];
  if (normalised.startsWith(`${newsPrefix}/`)) {
    return `${ROUTES.news[target]}/${normalised.slice(newsPrefix.length + 1)}`;
  }

  return ROUTES.home[target];
}

/** Resolves strings for one locale. Returned as a function so a component calls
 *  `t('nav.news')` once per use instead of threading the locale into every
 *  lookup. A missing key is a type error, so there is no runtime fallback to
 *  hide behind. */
export function useTranslations(locale: Locale) {
  const dictionary = dictionaries[locale];
  return function t(key: TranslationKey): string {
    return dictionary[key];
  };
}

/** Dates in the reader's locale rather than the server's. */
export function formatDate(value: string | Date, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
