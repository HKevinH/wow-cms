import type { WowCmsModule } from '@wowcms/module-sdk';
import { realmsMigrations } from './migrations';
import { RealmsApiModule } from './api.module';

export { RealmsApiModule } from './api.module';
export const realmsModule: WowCmsModule = {
  id: 'realms', version: '1.0.0',
  permissions: [{ key: 'realms.manage', description: 'Manage configured realms.' }],
  dashboard: [{ path: '/admin/realms', title: 'Realms', permission: 'realms.manage', order: 5 }],
  migrations: realmsMigrations, api: RealmsApiModule,
};
