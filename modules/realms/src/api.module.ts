import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { RequirePermission } from '@wowcms/module-auth';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export const REALMS_POOL = Symbol('REALMS_POOL');

interface RealmRow extends RowDataPacket {
  id: number; slug: string; name: string; description: string; expansion: string; realmlist: string;
  auth_database_url: string; characters_database_url: string; world_database_url: string;
  soap_host: string; soap_port: number; auth_port: number; world_port: number; store_url: string; theme: string; enabled: number;
}

interface RealmBody {
  slug?: string; name?: string; description?: string; expansion?: string; realmlist?: string;
  authDatabaseUrl?: string; charactersDatabaseUrl?: string; worldDatabaseUrl?: string;
  soapHost?: string; soapPort?: number | string; authPort?: number | string; worldPort?: number | string;
  storeUrl?: string; theme?: string; enabled?: boolean;
}

function publicRealm(row: RealmRow) {
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description, expansion: row.expansion,
    realmlist: row.realmlist, soapHost: row.soap_host, soapPort: row.soap_port, authPort: row.auth_port,
    worldPort: row.world_port, storeUrl: row.store_url, theme: row.theme, enabled: Boolean(row.enabled),
  };
}

@Controller()
export class RealmsController {
  constructor(@Inject(REALMS_POOL) private readonly pool: Pool) {}

  @Get()
  list() { return this.pool.query<RealmRow[]>('SELECT * FROM realm ORDER BY name').then(([rows]) => rows.map(publicRealm)); }

  @Get(':id')
  async read(@Param('id') id: string) { const row = await this.find(id); return publicRealm(row); }

  @Post()
  @RequirePermission('realms.manage')
  async create(@Body() body: RealmBody) { try { const values = normalize(body, true); const [result] = await this.pool.execute('INSERT INTO realm (slug, name, description, expansion, realmlist, auth_database_url, characters_database_url, world_database_url, soap_host, soap_port, auth_port, world_port, store_url, theme, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', values); return this.read(String((result as { insertId: number }).insertId)); } catch (error) { if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ConflictException('Realm slug or one of its ports already exists.'); throw error; } }

  @Put(':id')
  @RequirePermission('realms.manage')
  async update(@Param('id') id: string, @Body() body: RealmBody) { try { const row = await this.find(id); const values = normalize(body, false); await this.pool.execute('UPDATE realm SET slug=?, name=?, description=?, expansion=?, realmlist=?, auth_database_url=?, characters_database_url=?, world_database_url=?, soap_host=?, soap_port=?, auth_port=?, world_port=?, store_url=?, theme=?, enabled=? WHERE id=?', [...values, row.id]); return this.read(String(row.id)); } catch (error) { if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ConflictException('Realm slug or one of its ports already exists.'); throw error; } }

  @Delete(':id')
  @RequirePermission('realms.manage')
  async disable(@Param('id') id: string) { const row = await this.find(id); await this.pool.execute('UPDATE realm SET enabled = 0 WHERE id = ?', [row.id]); return { ok: true as const }; }

  private async find(id: string) { if (!/^\d+$/.test(id)) throw new NotFoundException('Realm not found.'); const [rows] = await this.pool.query<RealmRow[]>('SELECT * FROM realm WHERE id = ?', [id]); if (!rows[0]) throw new NotFoundException('Realm not found.'); return rows[0]; }
}

function normalize(body: RealmBody, required: boolean): (string | number | boolean)[] {
  const slug = body.slug?.trim(); const name = body.name?.trim();
  if ((required && !slug) || (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) throw new BadRequestException('Realm slug must use lowercase letters, numbers and hyphens.');
  if (required && !name) throw new BadRequestException('Realm name is required.');
  const port = (value: number | string | undefined, fallback: number) => { const result = Number(value ?? fallback); if (!Number.isInteger(result) || result < 1 || result > 65535) throw new BadRequestException('Realm ports must be between 1 and 65535.'); return result; };
  return [slug || '', name || '', body.description?.trim() || '', body.expansion?.trim() || '', body.realmlist?.trim() || '', body.authDatabaseUrl?.trim() || '', body.charactersDatabaseUrl?.trim() || '', body.worldDatabaseUrl?.trim() || '', body.soapHost?.trim() || '127.0.0.1', port(body.soapPort, 7878), port(body.authPort, 3724), port(body.worldPort, 8085), body.storeUrl?.trim() || '', body.theme?.trim() || 'pandaria', body.enabled !== false];
}

export class RealmsApiModule { static register(pool: Pool) { return { module: RealmsApiModule, controllers: [RealmsController], providers: [{ provide: REALMS_POOL, useValue: pool }] }; } }
