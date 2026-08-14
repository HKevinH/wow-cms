import { beforeEach, describe, expect, it } from 'vitest';
import type { ContentLocale, NewsDraft, NewsPage, NewsPost, NewsQuery } from '@wowcms/contracts';
import {
  ContentService,
  InvalidPostError,
  PostNotFoundError,
  SlugTakenError,
  type PostRepository,
} from './content.service';

class FakeRepository implements PostRepository {
  posts: NewsPost[] = [];
  lastQuery: NewsQuery | null = null;
  private nextId = 1;

  async list(query: NewsQuery): Promise<NewsPage> {
    this.lastQuery = query;
    const items = this.posts.filter(
      (post) => query.includeDrafts === true || post.publishedAt !== null,
    );
    return { items, total: items.length };
  }

  async findBySlug(slug: string, locale: ContentLocale): Promise<NewsPost | null> {
    return this.posts.find((post) => post.slug === slug && post.locale === locale) ?? null;
  }

  async findById(id: number): Promise<NewsPost | null> {
    return this.posts.find((post) => post.id === id) ?? null;
  }

  async create(draft: NewsDraft, publishedAt: string | null): Promise<number> {
    const id = this.nextId++;
    this.posts.push({
      ...draft,
      id,
      publishedAt,
      updatedAt: '2026-08-13T12:00:00.000Z',
    });
    return id;
  }

  async update(id: number, draft: NewsDraft, publishedAt: string | null): Promise<void> {
    const index = this.posts.findIndex((post) => post.id === id);
    this.posts[index] = {
      ...this.posts[index]!,
      ...draft,
      id,
      publishedAt,
    };
  }

  async remove(id: number): Promise<void> {
    this.posts = this.posts.filter((post) => post.id !== id);
  }
}

const draft = (overrides: Partial<NewsDraft> = {}): NewsDraft => ({
  slug: '',
  locale: 'es',
  title: 'El reino ya está abierto',
  excerpt: 'Ya se puede entrar.',
  category: 'Anuncio',
  body: 'Contenido del anuncio.',
  coverUrl: null,
  published: true,
  ...overrides,
});

let repository: FakeRepository;
let service: ContentService;
const clock = new Date('2026-08-13T12:00:00.000Z');

beforeEach(() => {
  repository = new FakeRepository();
  service = new ContentService(repository, () => clock);
});

describe('create', () => {
  it('derives a slug from the title when none was typed', async () => {
    await service.create(draft());
    expect(repository.posts[0]?.slug).toBe('el-reino-ya-esta-abierto');
  });

  it('keeps a slug the editor typed', async () => {
    await service.create(draft({ slug: 'apertura' }));
    expect(repository.posts[0]?.slug).toBe('apertura');
  });

  it('refuses a slug that would not survive a URL', async () => {
    await expect(service.create(draft({ slug: 'El Reino!' }))).rejects.toThrow(InvalidPostError);
  });

  it('refuses a post with no title or no body', async () => {
    await expect(service.create(draft({ title: '   ' }))).rejects.toThrow(/needs a title/);
    await expect(service.create(draft({ body: '  \n ' }))).rejects.toThrow(/needs a body/);
  });

  it('refuses a slug already used in the same locale', async () => {
    await service.create(draft({ slug: 'apertura' }));
    await expect(service.create(draft({ slug: 'apertura' }))).rejects.toThrow(SlugTakenError);
  });

  it('allows the same slug in another locale', async () => {
    // The two language versions of one announcement are separate posts, and the
    // prefix in the URL already tells them apart.
    await service.create(draft({ slug: 'apertura', locale: 'es' }));
    await expect(service.create(draft({ slug: 'apertura', locale: 'en' }))).resolves.toBeTruthy();
  });

  it('stamps a publication date when published, and none when a draft', async () => {
    await service.create(draft({ slug: 'publicado', published: true }));
    await service.create(draft({ slug: 'borrador', published: false }));

    expect(repository.posts[0]?.publishedAt).toBe(clock.toISOString());
    expect(repository.posts[1]?.publishedAt).toBeNull();
  });
});

describe('update', () => {
  it('reports a post that is not there', async () => {
    await expect(service.update(404, draft())).rejects.toThrow(PostNotFoundError);
  });

  it('lets a post keep its own slug', async () => {
    const { id } = await service.create(draft({ slug: 'apertura' }));
    await expect(service.update(id, draft({ slug: 'apertura' }))).resolves.toBeUndefined();
  });

  it('refuses to take a slug another post is using', async () => {
    await service.create(draft({ slug: 'apertura' }));
    const { id } = await service.create(draft({ slug: 'segunda' }));
    await expect(service.update(id, draft({ slug: 'apertura' }))).rejects.toThrow(SlugTakenError);
  });

  it('keeps the original publication date when republishing', async () => {
    // A corrected post is not news from today.
    const { id } = await service.create(draft({ slug: 'apertura', published: true }));
    const original = repository.posts[0]?.publishedAt;

    await service.update(id, draft({ slug: 'apertura', published: false }));
    await service.update(id, draft({ slug: 'apertura', published: true }));

    expect(repository.posts[0]?.publishedAt).toBe(original);
  });

  it('clears the publication date when unpublishing', async () => {
    const { id } = await service.create(draft({ slug: 'apertura', published: true }));
    await service.update(id, draft({ slug: 'apertura', published: false }));
    expect(repository.posts[0]?.publishedAt).toBeNull();
  });
});

describe('read', () => {
  it('returns a published post', async () => {
    await service.create(draft({ slug: 'apertura' }));
    expect((await service.read('apertura', 'es')).title).toBe('El reino ya está abierto');
  });

  it('hides a draft from the public behind a 404, not a 403', async () => {
    // That an unpublished post exists is itself not public.
    await service.create(draft({ slug: 'borrador', published: false }));
    await expect(service.read('borrador', 'es')).rejects.toThrow(PostNotFoundError);
  });

  it('shows a draft to a caller allowed to ask for one', async () => {
    await service.create(draft({ slug: 'borrador', published: false }));
    await expect(service.read('borrador', 'es', true)).resolves.toBeTruthy();
  });

  it('does not find a post from another locale', async () => {
    await service.create(draft({ slug: 'apertura', locale: 'es' }));
    await expect(service.read('apertura', 'en')).rejects.toThrow(PostNotFoundError);
  });
});

describe('list', () => {
  it('excludes drafts unless they were deliberately asked for', async () => {
    await service.list({});
    expect(repository.lastQuery?.includeDrafts).toBe(false);

    await service.list({ includeDrafts: true });
    expect(repository.lastQuery?.includeDrafts).toBe(true);
  });

  it('clamps the page size, so a caller cannot ask for the whole table', async () => {
    await service.list({ limit: 5000 });
    expect(repository.lastQuery?.limit).toBe(100);

    await service.list({ limit: 0 });
    expect(repository.lastQuery?.limit).toBe(1);
  });

  it('refuses a negative offset', async () => {
    await service.list({ offset: -10 });
    expect(repository.lastQuery?.offset).toBe(0);
  });
});

describe('remove', () => {
  it('deletes a post that exists', async () => {
    const { id } = await service.create(draft());
    await service.remove(id);
    expect(repository.posts).toEqual([]);
  });

  it('reports one that does not', async () => {
    await expect(service.remove(404)).rejects.toThrow(PostNotFoundError);
  });
});
