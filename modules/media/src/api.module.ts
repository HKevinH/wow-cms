import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import type { MediaAsset, MediaPage, RemoteMediaInput } from '@wowcms/contracts';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { RequirePermission } from '@wowcms/module-auth';
export const MEDIA_POOL = Symbol('MEDIA_POOL');

@Controller()
export class MediaController {
  constructor(@Inject(MEDIA_POOL) private readonly pool: Pool) {}
  @Get() async list(@Query() query: { search?: string; kind?: string; limit?: string; offset?: string }): Promise<MediaPage> {
    const where: string[] = []; const values: unknown[] = [];
    if (query.search) { where.push('(title LIKE ? OR url LIKE ?)'); values.push(`%${query.search}%`, `%${query.search}%`); }
    if (query.kind) { where.push('kind = ?'); values.push(query.kind); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM media_asset ${clause} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`, [...values, Number(query.limit) || 50, Number(query.offset) || 0]);
    const [count] = await this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM media_asset ${clause}`, values);
    return { items: rows.map(toAsset), total: Number(count[0]?.total ?? 0) };
  }
  @Post('remote') @RequirePermission('media.manage') async remote(@Body() body: RemoteMediaInput): Promise<{ id: number }> {
    let url: URL; try { url = new URL(body.url); } catch { throw new Error('Media URL is invalid.'); }
    if (!['http:', 'https:'].includes(url.protocol) || !body.title?.trim()) throw new Error('Media title and URL are required.');
    const [result] = await this.pool.execute<ResultSetHeader>('INSERT INTO media_asset (kind, title, url, mime_type) VALUES (?, ?, ?, ?)', ['other', body.title.trim().slice(0, 200), url.toString(), 'remote']);
    return { id: result.insertId };
  }
  @Delete(':id') @RequirePermission('media.manage') async remove(@Param('id') id: string) { await this.pool.execute('DELETE FROM media_asset WHERE id = ?', [Number(id)]); return { ok: true as const }; }
}
function toAsset(row: RowDataPacket): MediaAsset { return { id: Number(row.id), kind: row.kind, title: String(row.title), url: String(row.url), mimeType: String(row.mime_type), bytes: row.bytes == null ? null : Number(row.bytes), width: row.width == null ? null : Number(row.width), height: row.height == null ? null : Number(row.height), uploadedAt: new Date(String(row.uploaded_at).replace(' ', 'T') + 'Z').toISOString() }; }
export class MediaApiModule { static register(pool: Pool) { return { module: MediaApiModule, controllers: [MediaController], providers: [{ provide: MEDIA_POOL, useValue: pool }] }; } }
