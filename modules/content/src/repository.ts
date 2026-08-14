import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { ContentLocale, NewsDraft, NewsPage, NewsPost, NewsQuery, PostId, NewsSummary } from '@wowcms/contracts';
import type { PostRepository } from './content.service';

export class MysqlPostRepository implements PostRepository {
  constructor(private readonly pool: Pool) {}

  async list(query: NewsQuery): Promise<NewsPage> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.locale) { where.push('locale = ?'); values.push(query.locale); }
    if (query.category) { where.push('category = ?'); values.push(query.category); }
    if (!query.includeDrafts) { where.push('published = 1 AND (published_at IS NULL OR published_at <= UTC_TIMESTAMP())'); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, slug, locale, title, excerpt, category, published_at, cover_url FROM content_post ${clause} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...values, query.limit ?? 12, query.offset ?? 0],
    );
    const [count] = await this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM content_post ${clause}`, values);
    return { items: rows.map(toSummary), total: Number(count[0]?.total ?? 0) };
  }

  async findBySlug(slug: string, locale: ContentLocale): Promise<NewsPost | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM content_post WHERE slug = ? AND locale = ? LIMIT 1', [slug, locale]);
    return rows[0] ? toPost(rows[0]) : null;
  }

  async findById(id: PostId): Promise<NewsPost | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM content_post WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? toPost(rows[0]) : null;
  }

  async create(draft: NewsDraft, publishedAt: string | null): Promise<PostId> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO content_post (slug, locale, title, excerpt, category, body, cover_url, published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [draft.slug, draft.locale, draft.title, draft.excerpt, draft.category, draft.body, draft.coverUrl, draft.published ? 1 : 0, publishedAt],
    );
    return result.insertId;
  }

  async update(id: PostId, draft: NewsDraft, publishedAt: string | null): Promise<void> {
    await this.pool.execute(
      'UPDATE content_post SET slug = ?, locale = ?, title = ?, excerpt = ?, category = ?, body = ?, cover_url = ?, published = ?, published_at = ? WHERE id = ?',
      [draft.slug, draft.locale, draft.title, draft.excerpt, draft.category, draft.body, draft.coverUrl, draft.published ? 1 : 0, publishedAt, id],
    );
  }

  async remove(id: PostId): Promise<void> { await this.pool.execute('DELETE FROM content_post WHERE id = ?', [id]); }
}

function toSummary(row: RowDataPacket): NewsSummary {
  return { id: Number(row.id), slug: String(row.slug), locale: row.locale as ContentLocale, title: String(row.title), excerpt: String(row.excerpt), category: String(row.category), publishedAt: row.published_at ? new Date(String(row.published_at).replace(' ', 'T') + 'Z').toISOString() : null, coverUrl: row.cover_url ? String(row.cover_url) : null };
}
function toPost(row: RowDataPacket): NewsPost {
  return { ...toSummary(row), body: String(row.body), updatedAt: new Date(String(row.updated_at).replace(' ', 'T') + 'Z').toISOString() };
}
