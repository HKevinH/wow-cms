import 'reflect-metadata';
import cookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ADAPTER_CAPABILITIES, type AdapterCapability, type AdapterReport } from '@wowcms/contracts';
import {
  buildSchemaProbe,
  createEmulatorPool,
  selectAdapter,
  trinity548Adapter,
} from '@wowcms/core-adapters';
import { resolveModules } from '@wowcms/module-sdk';
import { accountsModule } from '@wowcms/module-accounts';
import { authModule } from '@wowcms/module-auth';
import { contentModule } from '@wowcms/module-content';
import { mediaModule } from '@wowcms/module-media';
import { settingsModule } from '@wowcms/module-settings';
import { createCmsPool, runMigrations } from '@wowcms/platform-db';
import { AppModule } from './app.module';

const AUTH_URL = process.env.WOWCMS_AUTH_URL ?? 'mysql://root:root@127.0.0.1:3306/auth';
const CMS_URL = process.env.WOWCMS_DATABASE_URL ?? 'mysql://root:root@127.0.0.1:3306/wowcms';

/** Everything the platform knows about the server it is talking to is decided
 *  here, once, before the first request. A misconfiguration surfaces now with a
 *  cause attached rather than on whichever page happens to need it first. */
async function detect(): Promise<{ report: AdapterReport; pool: ReturnType<typeof createEmulatorPool>; fieldMap: import('@wowcms/core-adapters').FieldMap }> {
  const pool = createEmulatorPool(AUTH_URL);
  const connection = await pool.getConnection();
  const databaseName = new URL(AUTH_URL).pathname.slice(1);
  const probe = await buildSchemaProbe(connection, databaseName);
  connection.release();

  const { adapter, score } = selectAdapter([trinity548Adapter], probe);

  // Only accounts is claimed for now; the remaining capabilities arrive with the
  // modules that need them, and are reported as missing until then.
  const capabilities: AdapterCapability[] = ['accounts'];
  const missing = ADAPTER_CAPABILITIES.filter((c) => !capabilities.includes(c)).map(
    (c) => `${c}: no module in this build reads it yet`,
  );

  return {
    pool,
    fieldMap: adapter.defaultFieldMap,
    report: { adapterId: adapter.id, score, capabilities, missing },
  };
}

async function bootstrap(): Promise<void> {
  const { pool, fieldMap, report } = await detect();
  const cmsPool = createCmsPool(CMS_URL);

  const { enabled, disabled } = resolveModules([authModule, accountsModule, contentModule, mediaModule, settingsModule], report.capabilities);
  const cmsConnection = await cmsPool.getConnection();
  // mysql2 exposes mutable parameter arrays while the runner intentionally accepts
  // readonly values for testability; the runtime methods are structurally identical.
  try { await runMigrations(cmsConnection as never, enabled); } finally { cmsConnection.release(); }
  console.log(`Enabled modules: ${enabled.map((m) => m.id).join(', ') || 'none'}`);
  for (const entry of disabled) {
    console.warn(`Module '${entry.module.id}' disabled: ${entry.reason}`);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register({ pool, cmsPool, fieldMap, report }),
    new FastifyAdapter(),
  );
  await app.register(cookie);
  app.enableCors({
    origin: process.env.WOWCMS_WEB_ORIGIN ?? 'http://localhost:4321',
    credentials: true,
  });
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
  console.log(`API listening on ${await app.getUrl()} using adapter ${report.adapterId}`);
}

async function bootstrapInstaller(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.registerInstaller(), new FastifyAdapter());
  await app.register(cookie);
  app.enableCors({ origin: process.env.WOWCMS_WEB_ORIGIN ?? 'http://localhost:4321', credentials: true });
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
  console.log(`Installer API listening on ${await app.getUrl()}`);
}

// Startup failures must be loud: a platform that boots half-configured hides the
// cause until someone opens the page that needed it.
(process.env.WOWCMS_INSTALLER_MODE === 'true' ? bootstrapInstaller() : bootstrap()).catch((error: unknown) => {
  console.error('API failed to start:', error);
  process.exit(1);
});
