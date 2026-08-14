import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import type { SettingRecord } from '@wowcms/contracts';
import { SITE_SETTINGS_SCHEMA, applySchema } from '@wowcms/contracts';
import { RequirePermission } from '@wowcms/module-auth';
import type { Pool, RowDataPacket } from 'mysql2/promise';
export const SETTINGS_POOL = Symbol('SETTINGS_POOL');

@Controller()
export class SettingsController {
  constructor(@Inject(SETTINGS_POOL) private readonly pool: Pool) {}
  @Get() async get() { const [rows] = await this.pool.query<RowDataPacket[]>('SELECT namespace, setting_key AS `key`, setting_value AS value, updated_at AS updatedAt FROM settings_value WHERE namespace = ?', [SITE_SETTINGS_SCHEMA.namespace]); return { schema: SITE_SETTINGS_SCHEMA, values: applySchema(SITE_SETTINGS_SCHEMA, rows as SettingRecord[]) }; }
  @Get('public') async publicSettings() {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT namespace, setting_key AS `key`, setting_value AS value, updated_at AS updatedAt FROM settings_value WHERE namespace IN (?, ?)', [SITE_SETTINGS_SCHEMA.namespace, 'system']);
    const records = rows as SettingRecord[];
    return { installed: records.some((record) => record.namespace === 'system' && record.key === 'installationComplete' && record.value === 'true'), values: applySchema(SITE_SETTINGS_SCHEMA, records) };
  }
  @Put() @RequirePermission('settings.manage') async update(@Body() body: Record<string, unknown>) { for (const field of SITE_SETTINGS_SCHEMA.fields) { if (body[field.key] !== undefined) await this.pool.execute('INSERT INTO settings_value (namespace, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [SITE_SETTINGS_SCHEMA.namespace, field.key, String(body[field.key])]); } return this.get(); }
}
export class SettingsApiModule { static register(pool: Pool) { return { module: SettingsApiModule, controllers: [SettingsController], providers: [{ provide: SETTINGS_POOL, useValue: pool }] }; } }
