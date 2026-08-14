import { Controller, Get, Inject } from '@nestjs/common';
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'node:net';
import type { RealmPlayer, RealmStatus } from '@wowcms/contracts';

export const STATUS_AUTH_POOL = Symbol('STATUS_AUTH_POOL');
export const STATUS_CMS_POOL = Symbol('STATUS_CMS_POOL');

interface RealmRow extends RowDataPacket {
  id: number;
  name: string;
  realmlist: string;
  auth_database_url: string;
  characters_database_url: string;
  auth_port: number;
  world_port: number;
}
interface PlayerRow extends RowDataPacket { name: string; level: number; race: number; zone: number; }
interface UptimeRow extends RowDataPacket { starttime: number; uptime: number; }

const pools = new Map<string, Pool>();

@Controller('api/m/status')
export class StatusController {
  constructor(
    @Inject(STATUS_AUTH_POOL) private readonly defaultAuthPool: Pool,
    @Inject(STATUS_CMS_POOL) private readonly cmsPool: Pool,
  ) {}

  @Get()
  async get(): Promise<RealmStatus[]> {
    const [rows] = await this.cmsPool.query<RealmRow[]>(
      'SELECT id, name, realmlist, auth_database_url, characters_database_url, auth_port, world_port FROM realm WHERE enabled = 1 ORDER BY name',
    );
    const realms = rows.length ? rows : [fallbackRealm()];
    return Promise.all(realms.map((realm, index) => this.statusFor(realm, index === 0)));
  }

  private async statusFor(realm: RealmRow, isDefault: boolean): Promise<RealmStatus> {
    const authUrl = realm.auth_database_url || (isDefault ? process.env.WOWCMS_AUTH_URL : undefined);
    const charactersUrl = realm.characters_database_url || (isDefault ? process.env.WOWCMS_CHARACTERS_URL : undefined);
    const authPool = authUrl ? (isDefault && !realm.auth_database_url ? this.defaultAuthPool : poolFor(authUrl)) : null;
    const charactersPool = charactersUrl ? poolFor(charactersUrl) : null;
    const host = databaseHost(authUrl, realm.realmlist);
    const [authOnline, worldOnline] = await Promise.all([
      canConnect(host, Number(realm.auth_port || 3724)),
      canConnect(host, Number(realm.world_port || 8085)),
    ]);

    let players: RealmPlayer[] = [];
    try {
      if (!charactersPool) throw new Error('Characters database is not configured.');
      const [onlineRows] = await charactersPool.query<PlayerRow[]>('SELECT name, level, race, zone FROM characters WHERE online = 1 ORDER BY name');
      players = onlineRows.map((player) => ({
        name: String(player.name),
        level: Number(player.level) || null,
        faction: factionForRace(Number(player.race)),
        zone: zoneName(Number(player.zone)),
      }));
    } catch {
      // A realm without a characters URL can still report port availability.
    }

    let uptimeSeconds: number | null = null;
    try {
      if (!authPool) throw new Error('Auth database is not configured.');
      const [uptimeRows] = await authPool.query<UptimeRow[]>('SELECT starttime, uptime FROM uptime ORDER BY starttime DESC LIMIT 1');
      uptimeSeconds = uptimeRows[0]?.uptime == null ? null : Number(uptimeRows[0].uptime);
    } catch {
      // Some cores do not install the uptime table.
    }

    return { name: realm.name, realmlist: realm.realmlist, online: authOnline && worldOnline, playersOnline: players.length, uptimeSeconds, players, checkedAt: new Date().toISOString() };
  }
}

function fallbackRealm(): RealmRow {
  return { id: 0, name: 'Realm', realmlist: '', auth_database_url: process.env.WOWCMS_AUTH_URL ?? '', characters_database_url: process.env.WOWCMS_CHARACTERS_URL ?? '', auth_port: 3724, world_port: 8085 } as RealmRow;
}

function poolFor(url: string): Pool {
  const resolved = url;
  const existing = pools.get(resolved);
  if (existing) return existing;
  const pool = createPool(resolved);
  pools.set(resolved, pool);
  return pool;
}

function databaseHost(url: string | undefined, realmlist: string): string {
  if (url) { try { return new URL(url).hostname; } catch { /* use realmlist below */ } }
  return realmlist.replace(/^\s*set\s+realmlist\s+/i, '').split(/\s|:/)[0] || '127.0.0.1';
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (online: boolean) => { socket.destroy(); resolve(online); };
    socket.setTimeout(1500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function factionForRace(race: number): 'alliance' | 'horde' | 'neutral' {
  if ([1, 3, 4, 7, 11, 22].includes(race)) return 'alliance';
  if ([2, 5, 6, 8, 9, 10].includes(race)) return 'horde';
  return 'neutral';
}

function zoneName(zone: number): string {
  const known: Record<number, string> = {
    1: 'Dun Morogh',
    12: 'Elwynn Forest',
    14: 'Durotar',
    85: 'Tirisfal Glades',
    215: 'Duskwood',
    3430: 'Eversong Woods',
    3524: 'Azuremyst Isle',
    4298: 'Plaguelands: The Scarlet Enclave',
    4737: 'The Lost Isles',
    5805: 'The Jade Forest',
    5840: 'The Wandering Isle',
    5841: 'Krasarang Wilds',
    5842: 'The Veiled Stair',
    5843: 'The Valley of the Four Winds',
    5844: 'Kun-Lai Summit',
    5845: 'Townlong Steppes',
    5846: 'The Dread Wastes',
    6134: 'Vale of Eternal Blossoms',
    6755: 'The Timeless Isle',
  };
  return known[zone] ?? `Zone ${zone}`;
}
