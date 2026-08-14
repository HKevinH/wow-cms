/** Locales the CMS stores content in. Content is written per locale rather than
 *  translated field by field: a realm announces something in Spanish and may or
 *  may not write the English version, and pretending otherwise produces posts
 *  that are half empty. */
export const CONTENT_LOCALES = ['es', 'en'] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

export type PostId = number;

/** What a news list needs. Deliberately smaller than the post: an index page
 *  should not carry every body it is not going to render. */
export interface NewsSummary {
  readonly id: PostId;
  readonly slug: string;
  readonly locale: ContentLocale;
  readonly title: string;
  readonly excerpt: string;
  readonly category: string;
  /** ISO 8601. Null while the post is a draft. */
  readonly publishedAt: string | null;
  readonly coverUrl: string | null;
}

/** A post as a reader sees it. `body` is Markdown; it is rendered at read time
 *  so a change to how posts look never means rewriting stored content. */
export interface NewsPost extends NewsSummary {
  readonly body: string;
  readonly updatedAt: string;
}

/** What the editor submits. The id is absent when creating; the server owns
 *  timestamps, so they are absent here too. */
export interface NewsDraft {
  readonly slug: string;
  readonly locale: ContentLocale;
  readonly title: string;
  readonly excerpt: string;
  readonly category: string;
  readonly body: string;
  readonly coverUrl: string | null;
  /** A post is visible to readers only once this is true and publishedAt has
   *  passed; keeping them separate is what makes scheduling possible later. */
  readonly published: boolean;
}

export interface NewsQuery {
  readonly locale?: ContentLocale;
  readonly category?: string;
  /** Drafts are never returned unless asked for, and asking requires a
   *  permission the public API never has. */
  readonly includeDrafts?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface NewsPage {
  readonly items: readonly NewsSummary[];
  readonly total: number;
}

/** A slug has to survive being typed into an address bar and compared in SQL, so
 *  it is lowercase ASCII with single hyphens and nothing else. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    // Strips the combining marks NFD just separated out, so 'Añoranza' becomes
    // 'anoranza' rather than losing the letter entirely.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 96;
}
