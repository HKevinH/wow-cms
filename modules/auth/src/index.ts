import { CORE_PERMISSIONS } from '@wowcms/contracts';
import type { WowCmsModule } from '@wowcms/module-sdk';
import { authMigrations } from './migrations';
import { AuthApiModule } from './api.module';

export * from './auth.service';
export * from './auth.repository';
export * from './guard';
export * from './migrations';
export { AuthApiModule } from './api.module';
export { AUTH_STORE, EMULATOR_ACCESS } from './roles.controller';

/** Identity as a module, so its tables go through the same migration runner as
 *  everything else. Its routes are mounted at /api rather than /api/m/auth: the
 *  platform depends on this module, not the other way round, and a client should
 *  not have to know which module implements logging in. */
export const authModule: WowCmsModule = {
  id: 'auth',
  version: '1.0.0',
  requires: { capabilities: ['accounts'] },

  permissions: CORE_PERMISSIONS.map((key) => ({
    key,
    description: describe(key),
  })),

  dashboard: [
    { path: '/admin/accounts', title: 'Accounts', permission: 'accounts.manage', order: 80 },
    { path: '/admin/roles', title: 'Roles', permission: 'roles.manage', order: 90 },
  ],

  migrations: authMigrations,
  api: AuthApiModule,
};

function describe(key: (typeof CORE_PERMISSIONS)[number]): string {
  switch (key) {
    case 'admin.access':
      return 'Open the administration area.';
    case 'accounts.manage':
      return 'List accounts and grant them roles.';
    case 'roles.manage':
      return 'Create and edit roles.';
    case 'settings.manage':
      return 'Change site settings.';
  }
}
