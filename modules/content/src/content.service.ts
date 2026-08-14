import {
  isValidSlug,
  slugify,
  type ContentLocale,
  type NewsDraft,
  type NewsPage,
  type NewsPost,
  type NewsQuery,
  type PostId,
} from '@wowcms/contracts';

export class PostNotFoundError extends Error {
  constructor(reference: string) {
    super(`No post matching '${reference}'.`);
    this.name = 'PostNotFoundError';
  }
}

export class SlugTakenError extends Error {
  constructor(slug: string, locale: string) {
    super(`A ${locale} post with the slug '${slug}' already exists.`);
    this.name = 'SlugTakenError';
  }
}

export class InvalidPostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPostError';
  }
}

/** Storage, as the service needs it. The MySQL implementation is one of these;
 *  the tests use another, which is why none of the rules below need a database. */
export interface PostRepository {
  list(query: NewsQuery): Promise<NewsPage>;
  findBySlug(slug: string, locale: ContentLocale): Promise<NewsPost | null>;
  findById(id: PostId): Promise<NewsPost | null>;
  create(draft: NewsDraft, publishedAt: string | null): Promise<PostId>;
  update(id: PostId, draft: NewsDraft, publishedAt: string | null): Promise<void>;
  remove(id: PostId): Promise<void>;
}

const MAX_TITLE = 200;
const MAX_EXCERPT = 500;

export class ContentService {
  constructor(
    private readonly posts: PostRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The public list. Drafts are excluded here rather than in the controller, so
   *  a caller who forgets to say `includeDrafts: false` still gets the safe
   *  answer. Asking for drafts is a deliberate act. */
  list(query: NewsQuery): Promise<NewsPage> {
    return this.posts.list({
      ...query,
      includeDrafts: query.includeDrafts === true,
      limit: clamp(query.limit ?? 12, 1, 100),
      offset: Math.max(0, query.offset ?? 0),
    });
  }

  async read(slug: string, locale: ContentLocale, includeDrafts = false): Promise<NewsPost> {
    const post = await this.posts.findBySlug(slug, locale);
    if (post === null || (post.publishedAt === null && !includeDrafts)) {
      // A draft answers 404 to the public rather than 403: that a post exists is
      // itself something an unpublished post should not be leaking.
      throw new PostNotFoundError(slug);
    }
    return post;
  }

  async create(draft: NewsDraft): Promise<{ id: PostId }> {
    const clean = this.validate(draft);

    if ((await this.posts.findBySlug(clean.slug, clean.locale)) !== null) {
      throw new SlugTakenError(clean.slug, clean.locale);
    }

    return { id: await this.posts.create(clean, this.publicationDate(clean, null)) };
  }

  async update(id: PostId, draft: NewsDraft): Promise<void> {
    const existing = await this.posts.findById(id);
    if (existing === null) throw new PostNotFoundError(String(id));

    const clean = this.validate(draft);

    const collision = await this.posts.findBySlug(clean.slug, clean.locale);
    if (collision !== null && collision.id !== id) {
      throw new SlugTakenError(clean.slug, clean.locale);
    }

    await this.posts.update(id, clean, this.publicationDate(clean, existing.publishedAt));
  }

  async remove(id: PostId): Promise<void> {
    const existing = await this.posts.findById(id);
    if (existing === null) throw new PostNotFoundError(String(id));
    await this.posts.remove(id);
  }

  /** Publishing stamps a date; unpublishing clears it; republishing keeps the
   *  original. A post that comes back after a correction should not claim to be
   *  news from today. */
  private publicationDate(draft: NewsDraft, existing: string | null): string | null {
    if (!draft.published) return null;
    return existing ?? this.now().toISOString();
  }

  private validate(draft: NewsDraft): NewsDraft {
    const title = draft.title.trim();
    if (title.length === 0) throw new InvalidPostError('A post needs a title.');
    if (title.length > MAX_TITLE) {
      throw new InvalidPostError(`A title is at most ${MAX_TITLE} characters.`);
    }

    if (draft.body.trim().length === 0) throw new InvalidPostError('A post needs a body.');

    // An editor who leaves the slug alone gets one made from the title, which is
    // what they wanted; one who types a slug gets exactly what they typed, or an
    // error saying why it cannot be used.
    const slug = draft.slug.trim() === '' ? slugify(title) : draft.slug.trim();
    if (!isValidSlug(slug)) {
      throw new InvalidPostError(
        `'${slug}' is not a usable slug: lowercase letters, digits and single hyphens.`,
      );
    }

    return {
      ...draft,
      title,
      slug,
      excerpt: draft.excerpt.trim().slice(0, MAX_EXCERPT),
      category: draft.category.trim().slice(0, 64),
      coverUrl: draft.coverUrl?.trim() || null,
    };
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, Math.trunc(value)));
}
