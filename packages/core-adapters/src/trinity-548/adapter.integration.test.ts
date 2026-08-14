import { describe, expect, it } from 'vitest';
import { createEmulatorPool } from '../pool';
import { buildSchemaProbe } from '../schema-probe';
import { trinity548Adapter, createAccount, verifyPassword } from './adapter';

const url = process.env.WOWCMS_TEST_AUTH_URL;

// Skips rather than fails so the suite stays green without a live server.
describe.skipIf(!url)('trinity-5.4.8 adapter against a live auth database', () => {
  it('detects the schema of a real 5.4.8 server', async () => {
    const pool = createEmulatorPool(url!);
    const connection = await pool.getConnection();
    const probe = await buildSchemaProbe(connection, new URL(url!).pathname.slice(1));
    connection.release();

    expect(trinity548Adapter.detect(probe)).toBeGreaterThanOrEqual(80);
    await pool.end();
  });

  it('creates an account the emulator can authenticate', async () => {
    const pool = createEmulatorPool(url!);
    const map = trinity548Adapter.defaultFieldMap;
    const username = `CMSTEST${Date.now()}`;

    await createAccount(pool, map, { username, password: 'secret123', email: 'a@b.c' });

    // Reading it back through verifyPassword proves the stored hash matches what
    // the same rule produces, which is what the core's login check does.
    expect(await verifyPassword(pool, map, username, 'secret123')).toBeGreaterThan(0);
    expect(await verifyPassword(pool, map, username, 'wrong')).toBeNull();

    await pool.execute('DELETE FROM `account` WHERE `username` = ?', [username.toUpperCase()]);
    await pool.end();
  });
});
