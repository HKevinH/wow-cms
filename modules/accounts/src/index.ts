import type { WowCmsModule } from '@wowcms/module-sdk';

export * from './accounts.service';
export * from './adapter-gateway';
export * from './accounts.controller';
export * from './api.module';

/** The module's declaration. Everything the platform needs to know about it is
 *  here; nothing about accounts is wired into the core by hand. */
export const accountsModule: WowCmsModule = {
  id: 'accounts',
  version: '1.0.0',
  requires: { capabilities: ['accounts'] },
  permissions: [
    { key: 'accounts.manage', description: 'Create, lock and unlock game accounts' },
  ],
  dashboard: [{ path: '/admin/accounts', title: 'Accounts', permission: 'accounts.manage' }],
};
