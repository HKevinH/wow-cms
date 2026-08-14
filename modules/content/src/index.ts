import type { WowCmsModule } from '@wowcms/module-sdk';
import { contentMigrations } from './migrations';
import { ContentApiModule } from './api.module';
export * from './content.service';
export * from './migrations';
export { ContentApiModule } from './api.module';
export const contentModule: WowCmsModule = {
  id: 'content', version: '1.0.0', permissions: [{ key: 'content.manage', description: 'Create and edit news posts.' }],
  dashboard: [{ path: '/admin/news', title: 'News', permission: 'content.manage', order: 10 }], migrations: contentMigrations, api: ContentApiModule,
};
