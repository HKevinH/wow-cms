import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import type { ContentLocale, NewsDraft } from '@wowcms/contracts';
import { ContentService, PostNotFoundError, SlugTakenError, InvalidPostError } from './content.service';
import { MysqlPostRepository } from './repository';
import { RequirePermission } from '@wowcms/module-auth';
import type { Pool } from 'mysql2/promise';

export const CONTENT_SERVICE = Symbol('CONTENT_SERVICE');

@Controller('news')
export class ContentController {
  constructor(@Inject(CONTENT_SERVICE) private readonly service: ContentService) {}
  @Get() list(@Query() q: { locale?: ContentLocale; category?: string; limit?: string; offset?: string }) { return this.service.list({ ...q, limit: Number(q.limit) || 12, offset: Number(q.offset) || 0 }); }
  @Get(':slug') async read(@Param('slug') slug: string, @Query('locale') locale: ContentLocale = 'es') { try { return await this.service.read(slug, locale); } catch (e) { throw new NotFoundException((e as Error).message); } }
  @Post() @RequirePermission('content.manage') create(@Body() body: NewsDraft) { return this.run(() => this.service.create(body)); }
  @Put(':id') @RequirePermission('content.manage') update(@Param('id') id: string, @Body() body: NewsDraft) { return this.run(() => this.service.update(Number(id), body).then(() => ({ ok: true as const }))); }
  @Delete(':id') @RequirePermission('content.manage') remove(@Param('id') id: string) { return this.run(() => this.service.remove(Number(id)).then(() => ({ ok: true as const }))); }
  private async run<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (e) { if (e instanceof PostNotFoundError) throw new NotFoundException(e.message); if (e instanceof SlugTakenError || e instanceof InvalidPostError) throw new Error(e.message); throw e; } }
}

export class ContentApiModule {
  static register(pool: Pool) {
    return {
      module: ContentApiModule,
      controllers: [ContentController],
      providers: [{ provide: CONTENT_SERVICE, useFactory: () => new ContentService(new MysqlPostRepository(pool)) }],
    };
  }
}
