import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'node:net';
import type { RealmStatus } from '@wowcms/contracts';

export const STATUS_AUTH_POOL = Symbol('STATUS_AUTH_POOL');
export const STATUS_CMS_POOL = Symbol('STATUS_CMS_POOL');

interface RealmRow extends RowDataPacket {
  name: string;
  auth_port: number;
  world_port: number;
}

@Controller('api/m/status')
export class StatusController {
  constructor(
    @Inject(STATUS_AUTH_POOL) private readonly authPool: Pool,
    @Inject(STATUS_CMS_POOL) private readonly cmsPool: Pool,
  ) {}

  @Get()
  async get(): Promise<RealmStatus> {
    const [rows] = await this.cmsPool.query<RealmRow[]>(
      'SELECT name, auth_port, world_port FROM realm WHERE enabled = 1 ORDER BY id LIMIT 1',
    );
    const realm = rows[0];
    const authUrl = new URL(process.env.WOWCMS_AUTH_URL ?? 'mysql://root:root@127.0.0.1:3306/auth');
    const host = authUrl.hostname;
    const authPort = Number(realm?.auth_port ?? 3724);
    const worldPort = Number(realm?.world_port ?? 8085);
    const [authOnline, worldOnline] = await Promise.all([
      canConnect(host, authPort),
      canConnect(host, worldPort),
    ]);

    let playersOnline: number | null = null;
    if (authOnline) {
      try {
        const [realms] = await this.authPool.query<RowDataPacket[]>(
          'SELECT population FROM realmlist ORDER BY id LIMIT 1',
        );
        playersOnline = realms[0]?.population == null ? null : Number(realms[0].population);
      } catch {
        // Some cores do not expose population in realmlist; online status remains valid.
      }
    }

    return {
      name: realm?.name ?? 'Realm',
      online: authOnline && worldOnline,
      playersOnline,
      uptimeSeconds: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (online: boolean) => {
      socket.destroy();
      resolve(online);
    };
    socket.setTimeout(1500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
