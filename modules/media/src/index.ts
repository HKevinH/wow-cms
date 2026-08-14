import type { WowCmsModule } from '@wowcms/module-sdk';
import { mediaMigrations } from './migrations';
import { MediaApiModule } from './api.module';
export { MediaApiModule } from './api.module';
export const mediaModule: WowCmsModule = { id: 'media', version: '1.0.0', permissions: [{ key: 'media.manage', description: 'Manage media assets.' }], dashboard: [{ path: '/admin/media', title: 'Media', permission: 'media.manage', order: 20 }], migrations: mediaMigrations, api: MediaApiModule };
