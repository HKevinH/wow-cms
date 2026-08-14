import type { ContentLocale, NewsPage, NewsPost, NewsSummary, RealmStatus } from '@wowcms/contracts';
import { apiFetch } from './api';
import { samplePosts } from './sample-content';

/** Reading content, with the API as the source and sample data as the floor.
 *
 *  Falling back rather than failing is deliberate. The site is built as static
 *  files, so a build machine that cannot reach the API would otherwise produce
 *  either a crash or a blank site — and a blank site is worse, because it looks
 *  finished. Every fallback here is logged, so a deployment that silently lost
 *  its API says so in the build output. */

function warn(what: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[content] ${what} unavailable, using sample content: ${reason}`);
}

function toSummary(post: NewsPost): NewsSummary {
  const { body: _body, updatedAt: _updatedAt, ...summary } = post;
  return summary;
}

export async function fetchNews(locale: ContentLocale, limit = 6): Promise<NewsSummary[]> {
  try {
    const page = await apiFetch<NewsPage>(
      `/api/m/content/news?locale=${locale}&limit=${limit}`,
    );
    // An empty database is not an error, but it is also not something to render
    // as an empty page on a site nobody has written for yet.
    if (page.items.length > 0) return [...page.items];
  } catch (error) {
    warn('news', error);
  }

  return samplePosts(locale).slice(0, limit).map(toSummary);
}

export async function fetchPost(slug: string, locale: ContentLocale): Promise<NewsPost | null> {
  try {
    return await apiFetch<NewsPost>(`/api/m/content/news/${encodeURIComponent(slug)}`);
  } catch (error) {
    warn(`post '${slug}'`, error);
    return samplePosts(locale).find((post) => post.slug === slug) ?? null;
  }
}

/** Every slug the static build needs a page for. Sample posts are included so a
 *  build with no API still produces the pages its own front page links to. */
export async function listPostSlugs(locale: ContentLocale): Promise<string[]> {
  try {
    const page = await apiFetch<NewsPage>(`/api/m/content/news?locale=${locale}&limit=500`);
    if (page.items.length > 0) return page.items.map((item) => item.slug);
  } catch (error) {
    warn('news index', error);
  }

  return samplePosts(locale).map((post) => post.slug);
}

/** Realm status. There is no sample fallback: inventing 'online' would be a lie
 *  about the one fact a visitor came to check. */
export async function fetchStatus(): Promise<RealmStatus | null> {
  try {
    return await apiFetch<RealmStatus>('/api/m/status');
  } catch (error) {
    warn('realm status', error);
    return null;
  }
}
