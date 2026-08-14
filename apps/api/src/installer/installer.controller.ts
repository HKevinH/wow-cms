import { BadRequestException, Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { createConnection } from 'mysql2/promise';
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
    if (process.env.PUBLIC_INSTALLATION_COMPLETE === 'true') {
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
        await writeEnvironment({ authUrl, cmsUrl, webOrigin: body.webOrigin, siteName: body.siteName, serverDescription: body.serverDescription, expansion: body.expansion, theme: body.theme, authPort: body.authPort, worldPort: body.worldPort, storeUrl: body.storeUrl });
      } finally { cmsConnection.release(); await cmsPool.end(); }
      void adapter;
    } finally { connection.release(); await emulator.end(); }
    return { ok: true, restartRequired: true };
  }
}

function assertDatabaseName(value: string): void {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(value)) throw new BadRequestException('Database names may contain only letters, numbers and underscores.');
}

function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl); url.pathname = `/${database}`; return url.toString();
}

async function writeEnvironment(values: { authUrl: string; cmsUrl: string; webOrigin?: string; siteName?: string; serverDescription?: string; expansion?: string; theme?: string; authPort?: string; worldPort?: string; storeUrl?: string }): Promise<void> {
  const file = resolve(process.env.INIT_CWD ?? process.cwd(), '.env');
  await mkdir(dirname(file), { recursive: true });
  const content = [
    `WOWCMS_AUTH_URL=${values.authUrl}`,
    `WOWCMS_DATABASE_URL=${values.cmsUrl}`,
    `WOWCMS_WEB_ORIGIN=${values.webOrigin?.trim() || 'http://localhost:4321'}`,
    'WOWCMS_INSTALLER_MODE=false',
    `PUBLIC_SITE_NAME=${values.siteName?.trim() || 'WoW CMS'}`,
    `PUBLIC_SERVER_DESCRIPTION=${values.serverDescription?.trim() || 'A private World of Warcraft realm.'}`,
    `PUBLIC_EXPANSION=${values.expansion?.trim() || 'Mists of Pandaria 5.4.8'}`,
    `PUBLIC_THEME=${values.theme?.trim() || 'pandaria'}`,
    `PUBLIC_AUTH_PORT=${values.authPort?.trim() || '3724'}`,
    `PUBLIC_WORLD_PORT=${values.worldPort?.trim() || '8085'}`,
    `PUBLIC_STORE_URL=${values.storeUrl?.trim() || 'http://localhost:8787'}`,
    'PUBLIC_INSTALLATION_COMPLETE=true',
    'PORT=3001',
    'PUBLIC_API_BASE=http://localhost:3001',
  ].join('\n') + '\n';
  await writeFile(file, content, 'utf8');
}
