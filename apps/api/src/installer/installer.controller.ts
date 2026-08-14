import { BadRequestException, Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { createConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildSchemaProbe, createEmulatorPool, selectAdapter, trinity548Adapter } from '@wowcms/core-adapters';
import { accountsModule } from '@wowcms/module-accounts';
import { authModule } from '@wowcms/module-auth';
import { contentModule } from '@wowcms/module-content';
import { mediaModule } from '@wowcms/module-media';
import { settingsModule } from '@wowcms/module-settings';
import { createCmsPool, runMigrations } from '@wowcms/platform-db';

interface InstallBody {
  mysqlAdminUrl?: string;
  authDatabase?: string;
  cmsDatabase?: string;
  webOrigin?: string;
  siteName?: string;
  serverDescription?: string;
  expansion?: string;
  theme?: string;
  authPort?: string;
  worldPort?: string;
  storeUrl?: string;
}

@Controller('api/install')
export class InstallerController {
  @Post()
  async install(@Body() body: InstallBody): Promise<{ ok: true; restartRequired: true }> {
    if (await this.isInstalled()) {
      throw new ForbiddenException('The installation is already complete.');
    }
    const adminUrl = body.mysqlAdminUrl?.trim();
    const authDatabase = body.authDatabase?.trim() || 'auth';
    const cmsDatabase = body.cmsDatabase?.trim() || 'wowcms';
    if (!adminUrl) throw new BadRequestException('MySQL connection URL is required.');
    assertDatabaseName(authDatabase); assertDatabaseName(cmsDatabase);
    const authUrl = databaseUrl(adminUrl, authDatabase);
    const cmsUrl = databaseUrl(adminUrl, cmsDatabase);

    const admin = await createConnection(adminUrl);
    try {
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${cmsDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally { await admin.end(); }

    const emulator = createEmulatorPool(authUrl);
    const connection = await emulator.getConnection();
    try {
      const probe = await buildSchemaProbe(connection, authDatabase);
      const { adapter } = selectAdapter([trinity548Adapter], probe);
      const cmsPool = createCmsPool(cmsUrl);
      const cmsConnection = await cmsPool.getConnection();
      try {
        const modules = [authModule, accountsModule, contentModule, mediaModule, settingsModule];
        await runMigrations(cmsConnection as never, modules);
        await saveInitialSettings(cmsPool, body);
        await writeEnvironment({ authUrl, cmsUrl, webOrigin: body.webOrigin });
      } finally { cmsConnection.release(); await cmsPool.end(); }
      void adapter;
    } finally { connection.release(); await emulator.end(); }
    return { ok: true, restartRequired: true };
  }

  private async isInstalled(): Promise<boolean> {
    const url = process.env.WOWCMS_DATABASE_URL;
    if (!url) return false;
    const pool = createCmsPool(url);
    try {
      const [rows] = await pool.query<(RowDataPacket & { setting_value: string })[]>('SELECT setting_value FROM settings_value WHERE namespace = ? AND setting_key = ?', ['system', 'installationComplete']);
      return rows[0]?.setting_value === 'true';
    } catch { return false; } finally { await pool.end(); }
  }
}

function assertDatabaseName(value: string): void {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(value)) throw new BadRequestException('Database names may contain only letters, numbers and underscores.');
}

function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl); url.pathname = `/${database}`; return url.toString();
}

async function saveInitialSettings(pool: ReturnType<typeof createCmsPool>, body: InstallBody): Promise<void> {
  const values: Record<string, string> = {
    siteName: body.siteName?.trim() || 'Reino de Pandaria',
    serverDescription: body.serverDescription?.trim() || 'A private World of Warcraft realm.',
    expansion: body.expansion?.trim() || 'Mists of Pandaria 5.4.8',
    theme: body.theme?.trim() || 'pandaria',
    authPort: body.authPort?.trim() || '3724',
    worldPort: body.worldPort?.trim() || '8085',
    storeUrl: body.storeUrl?.trim() || 'http://localhost:8787',
  };
  for (const [key, value] of Object.entries(values)) await pool.execute('INSERT INTO settings_value (namespace, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['site', key, value]);
  await pool.execute('INSERT INTO settings_value (namespace, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['system', 'installationComplete', 'true']);
}

async function writeEnvironment(values: { authUrl: string; cmsUrl: string; webOrigin?: string }): Promise<void> {
  const file = resolve(process.env.INIT_CWD ?? process.cwd(), '.env');
  await mkdir(dirname(file), { recursive: true });
  const content = [
    `WOWCMS_AUTH_URL=${values.authUrl}`,
    `WOWCMS_DATABASE_URL=${values.cmsUrl}`,
    `WOWCMS_WEB_ORIGIN=${values.webOrigin?.trim() || 'http://localhost:4321'}`,
    'WOWCMS_INSTALLER_MODE=false',
    'PORT=3001',
    'PUBLIC_API_BASE=http://localhost:3001',
  ].join('\n') + '\n';
  await writeFile(file, content, 'utf8');
}
