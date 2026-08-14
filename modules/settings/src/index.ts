import type { WowCmsModule } from '@wowcms/module-sdk';
import { settingsMigrations } from './migrations';
import { SettingsApiModule } from './api.module';
export { SettingsApiModule } from './api.module';
export const settingsModule: WowCmsModule = { id: 'settings', version: '1.0.0', permissions: [{ key: 'settings.manage', description: 'Manage site settings.' }], dashboard: [{ path: '/admin/settings', title: 'Settings', permission: 'settings.manage', order: 30 }], migrations: settingsMigrations, api: SettingsApiModule };
