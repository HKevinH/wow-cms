import { BadRequestException, Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
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
import { realmsModule } from '@wowcms/module-realms';
import { createCmsPool, runMigrations } from '@wowcms/platform-db';

interface InstallBody {
  mysqlAdminUrl?: string;
  authDatabase?: string;
  charactersDatabase?: string;
  worldDatabase?: string;
  cmsDatabase?: string;
  webOrigin?: string;
  siteName?: string;
  serverDescription?: string;
  expansion?: string;
  realmlist?: string;
  theme?: string;
  authPort?: string;
  worldPort?: string;
  soapPort?: string;
  storeUrl?: string;
  reinstall?: boolean | string;
}

@Controller('api/install')
export class InstallerController {
  @Get('status')
  async status(): Promise<{ installed: boolean }> {
    return { installed: await this.isInstalled() };
  }

  @Post()
  async install(@Body() body: InstallBody): Promise<{ ok: true; restartRequired: true }> {
    if (await this.isInstalled() && body.reinstall !== true && body.reinstall !== 'true') {
      throw new ForbiddenException('The installation is already complete.');
    }
    const adminUrl = body.mysqlAdminUrl?.trim();
    const authDatabase = body.authDatabase?.trim() || 'auth';
    const charactersDatabase = body.charactersDatabase?.trim() || 'characters';
    const worldDatabase = body.worldDatabase?.trim() || 'world';
    const cmsDatabase = body.cmsDatabase?.trim() || 'wowcms';
    if (!adminUrl) throw new BadRequestException('MySQL connection URL is required.');
    assertDatabaseName(authDatabase); assertDatabaseName(charactersDatabase); assertDatabaseName(worldDatabase); assertDatabaseName(cmsDatabase);
    const authUrl = databaseUrl(adminUrl, authDatabase);
    const cmsUrl = databaseUrl(adminUrl, cmsDatabase);

    const gameChecks = await checkGameDatabases(adminUrl, authDatabase, charactersDatabase, worldDatabase);
    if (!gameChecks.every((check) => check.ok)) throw new BadRequestException({ message: 'Emulator database verification failed.', checks: gameChecks });

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
        const modules = [authModule, accountsModule, contentModule, mediaModule, settingsModule, realmsModule];
        await runMigrations(cmsConnection as never, modules);
        await saveInitialSettings(cmsPool, body);
        await saveInitialRealm(cmsPool, body, { authUrl, charactersUrl: databaseUrl(adminUrl, charactersDatabase), worldUrl: databaseUrl(adminUrl, worldDatabase) });
        await writeEnvironment({ authUrl, cmsUrl, webOrigin: body.webOrigin, charactersUrl: databaseUrl(adminUrl, charactersDatabase), worldUrl: databaseUrl(adminUrl, worldDatabase) });
        process.env.WOWCMS_AUTH_URL = authUrl;
        process.env.WOWCMS_DATABASE_URL = cmsUrl;
        process.env.WOWCMS_CHARACTERS_URL = databaseUrl(adminUrl, charactersDatabase);
        process.env.WOWCMS_WORLD_URL = databaseUrl(adminUrl, worldDatabase);
      } finally { cmsConnection.release(); await cmsPool.end(); }
      void adapter;
    } finally { connection.release(); await emulator.end(); }
    return { ok: true, restartRequired: true };
  }

  @Post('check')
  async check(@Body() body: InstallBody) {
    const adminUrl = body.mysqlAdminUrl?.trim();
    if (!adminUrl) throw new BadRequestException('MySQL connection URL is required.');
    const auth = body.authDatabase?.trim() || 'auth';
    const characters = body.charactersDatabase?.trim() || 'characters';
    const world = body.worldDatabase?.trim() || 'world';
    assertDatabaseName(auth); assertDatabaseName(characters); assertDatabaseName(world);
    return { checks: await checkGameDatabases(adminUrl, auth, characters, world) };
  }

  private async isInstalled(): Promise<boolean> {
    const url = process.env.WOWCMS_DATABASE_URL ?? 'mysql://root:root@127.0.0.1:3306/wowcms';
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
    soapPort: body.soapPort?.trim() || '7878',
    storeUrl: body.storeUrl?.trim() || 'http://localhost:8787',
  };
  for (const [key, value] of Object.entries(values)) await pool.execute('INSERT INTO settings_value (namespace, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['site', key, value]);
  await pool.execute('INSERT INTO settings_value (namespace, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['system', 'installationComplete', 'true']);
}

async function saveInitialRealm(pool: ReturnType<typeof createCmsPool>, body: InstallBody, urls: { authUrl: string; charactersUrl: string; worldUrl: string }): Promise<void> {
  const name = body.siteName?.trim() || 'Reino de Pandaria';
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96) || 'default';
  const adminUrl = new URL(body.mysqlAdminUrl || 'mysql://127.0.0.1');
  await pool.execute('INSERT INTO realm (slug, name, description, expansion, realmlist, auth_database_url, characters_database_url, world_database_url, soap_host, soap_port, auth_port, world_port, store_url, theme, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), expansion=VALUES(expansion), auth_database_url=VALUES(auth_database_url), characters_database_url=VALUES(characters_database_url), world_database_url=VALUES(world_database_url), soap_port=VALUES(soap_port), auth_port=VALUES(auth_port), world_port=VALUES(world_port), store_url=VALUES(store_url), theme=VALUES(theme), enabled=1', [slug, name, body.serverDescription?.trim() || '', body.expansion?.trim() || '', body.realmlist?.trim() || '', urls.authUrl, urls.charactersUrl, urls.worldUrl, adminUrl.hostname, Number(body.soapPort || 7878), Number(body.authPort || 3724), Number(body.worldPort || 8085), body.storeUrl?.trim() || '', body.theme?.trim() || 'pandaria']);
}

async function checkGameDatabases(adminUrl: string, authDatabase: string, charactersDatabase: string, worldDatabase: string) {
  const entries = [
    ['auth', authDatabase],
    ['characters', charactersDatabase],
    ['world', worldDatabase],
  ] as const;
  const checks: { name: string; database: string; ok: boolean; tables: number; adapter?: string; score?: number; error?: string }[] = [];
  for (const [name, database] of entries) {
    try {
      const connection = await createConnection(databaseUrl(adminUrl, database));
      try {
        const [rows] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?', [database]);
        const result = { name, database, ok: true, tables: Number(rows[0]?.total ?? 0) };
        if (name === 'auth') {
          const probe = await buildSchemaProbe(connection, database);
          const selected = selectAdapter([trinity548Adapter], probe);
          checks.push({ ...result, adapter: selected.adapter.id, score: selected.score });
        } else checks.push(result);
      } finally { await connection.end(); }
    } catch (error) {
      checks.push({ name, database, ok: false, tables: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return checks;
}

async function writeEnvironment(values: { authUrl: string; cmsUrl: string; webOrigin?: string; charactersUrl: string; worldUrl: string }): Promise<void> {
  const file = resolve(process.env.INIT_CWD ?? process.cwd(), '.env');
  await mkdir(dirname(file), { recursive: true });
  const content = [
    `WOWCMS_AUTH_URL=${values.authUrl}`,
    `WOWCMS_DATABASE_URL=${values.cmsUrl}`,
    `WOWCMS_CHARACTERS_URL=${values.charactersUrl}`,
    `WOWCMS_WORLD_URL=${values.worldUrl}`,
    `WOWCMS_WEB_ORIGIN=${values.webOrigin?.trim() || 'http://localhost:4321'}`,
    'WOWCMS_INSTALLER_MODE=false',
    'PORT=3001',
    'PUBLIC_API_BASE=http://localhost:3001',
  ].join('\n') + '\n';
  await writeFile(file, content, 'utf8');
}
