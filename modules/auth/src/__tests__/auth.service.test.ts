import { beforeEach, describe, expect, it } from 'vitest';
import { OWNER_ROLE, SESSION_TTL_SECONDS, WILDCARD_PERMISSION, type Role } from '@wowcms/contracts';
import {
  AuthService,
  InvalidCredentialsError,
  hashToken,
  tokensMatch,
  type AuthStore,
  type CredentialChecker,
  type StoredSession,
} from '../auth.service';

class FakeStore implements AuthStore {
  sessions = new Map<string, StoredSession>();
  roles: Role[] = [];
  grants = new Map<number, number[]>();
  private nextRoleId = 1;

  async createSession(session: StoredSession): Promise<void> {
    this.sessions.set(session.tokenHash, session);
  }
  async findSession(tokenHash: string): Promise<StoredSession | null> {
    return this.sessions.get(tokenHash) ?? null;
  }
  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
  async deleteExpiredSessions(now: Date): Promise<number> {
    let removed = 0;
    for (const [hash, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(hash);
        removed += 1;
      }
    }
    return removed;
  }
  async rolesOf(accountId: number): Promise<Role[]> {
    const ids = this.grants.get(accountId) ?? [];
    return this.roles.filter((role) => ids.includes(role.id));
  }
  async countRoles(): Promise<number> {
    return this.roles.length;
  }
  async createRole(name: string, description: string, permissions: readonly string[]): Promise<number> {
    const id = this.nextRoleId++;
    this.roles.push({ id, name, description, permissions: [...permissions] });
    return id;
  }
  async grantRole(accountId: number, roleId: number): Promise<void> {
    this.grants.set(accountId, [...(this.grants.get(accountId) ?? []), roleId]);
  }
}

const checker = (accountId: number | null): CredentialChecker => ({
  async verify() {
    return accountId;
  },
});

let store: FakeStore;
let clock: Date;
const now = () => clock;

beforeEach(() => {
  store = new FakeStore();
  clock = new Date('2026-08-13T12:00:00.000Z');
});

describe('login', () => {
  it('refuses a wrong password without opening a session', async () => {
    const service = new AuthService(checker(null), store, now);
    await expect(service.login('chen', 'wrong')).rejects.toThrow(InvalidCredentialsError);
    expect(store.sessions.size).toBe(0);
  });

  it('opens a session that expires one TTL from now', async () => {
    const service = new AuthService(checker(7), store, now);
    const { session } = await service.login('chen', 'right');

    expect(session.accountId).toBe(7);
    expect(session.expiresAt.getTime() - clock.getTime()).toBe(SESSION_TTL_SECONDS * 1000);
  });

  it('stores the token hashed, never the token', async () => {
    // A dump of this table must not hand anyone a working session.
    const service = new AuthService(checker(7), store, now);
    const { token, session } = await service.login('chen', 'right');

    expect(session.tokenHash).not.toBe(token);
    expect([...store.sessions.keys()]).toEqual([hashToken(token)]);
  });

  it('normalises the username the way the emulator does', async () => {
    const service = new AuthService(checker(7), store, now);
    const { session } = await service.login('chen', 'right');
    expect(session.username).toBe('CHEN');
  });

  it('issues a different token every time', async () => {
    const service = new AuthService(checker(7), store, now);
    const first = await service.login('chen', 'right');
    const second = await service.login('chen', 'right');
    expect(first.token).not.toBe(second.token);
  });
});

describe('first-run ownership', () => {
  it('grants owner to the first account to log in', async () => {
    const service = new AuthService(checker(7), store, now);
    await service.login('chen', 'right');

    const viewer = await service.resolve(
      (await service.login('chen', 'right')).token,
    );
    expect(viewer?.roles).toEqual([OWNER_ROLE]);
    expect(viewer?.permissions).toEqual([WILDCARD_PERMISSION]);
  });

  it('closes the window once a role exists', async () => {
    // The second person to log in must not also become the owner.
    const first = new AuthService(checker(7), store, now);
    await first.login('chen', 'right');

    const second = new AuthService(checker(8), store, now);
    const { token } = await second.login('lorewalker', 'right');

    expect(await second.resolve(token)).toMatchObject({ accountId: 8, roles: [] });
    expect(store.roles).toHaveLength(1);
  });
});

describe('resolve', () => {
  it('returns null without a token', async () => {
    const service = new AuthService(checker(7), store, now);
    expect(await service.resolve(undefined)).toBeNull();
  });

  it('returns null for a token nobody issued', async () => {
    const service = new AuthService(checker(7), store, now);
    expect(await service.resolve('deadbeef')).toBeNull();
  });

  it('rejects an expired session and deletes it on the way past', async () => {
    const service = new AuthService(checker(7), store, now);
    const { token } = await service.login('chen', 'right');

    clock = new Date(clock.getTime() + (SESSION_TTL_SECONDS + 1) * 1000);

    expect(await service.resolve(token)).toBeNull();
    expect(store.sessions.size).toBe(0);
  });

  it('merges the permissions of every role, without repeats', async () => {
    const service = new AuthService(checker(7), store, now);
    const editor = await store.createRole('editor', '', ['content.write', 'media.upload']);
    const moderator = await store.createRole('moderator', '', ['content.write', 'accounts.manage']);
    await store.grantRole(7, editor);
    await store.grantRole(7, moderator);

    const { token } = await service.login('chen', 'right');
    const viewer = await service.resolve(token);

    expect([...(viewer?.permissions ?? [])].sort()).toEqual([
      'accounts.manage',
      'content.write',
      'media.upload',
    ]);
  });
});

describe('logout and sweep', () => {
  it('ends the session the token names', async () => {
    const service = new AuthService(checker(7), store, now);
    const { token } = await service.login('chen', 'right');

    await service.logout(token);

    expect(await service.resolve(token)).toBeNull();
  });

  it('does nothing when there is no cookie to end', async () => {
    const service = new AuthService(checker(7), store, now);
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('removes only the sessions that have expired', async () => {
    const service = new AuthService(checker(7), store, now);
    const stale = await service.login('chen', 'right');
    clock = new Date(clock.getTime() + SESSION_TTL_SECONDS * 1000);
    const fresh = await service.login('chen', 'right');

    clock = new Date(clock.getTime() + 1000);
    expect(await service.sweep()).toBe(1);
    expect(await service.resolve(stale.token)).toBeNull();
    expect(await service.resolve(fresh.token)).not.toBeNull();
  });
});

describe('tokensMatch', () => {
  it('matches a hash with itself and nothing else', () => {
    const hash = hashToken('a-token');
    expect(tokensMatch(hash, hash)).toBe(true);
    expect(tokensMatch(hash, hashToken('another-token'))).toBe(false);
  });

  it('handles differing lengths without throwing', () => {
    // timingSafeEqual throws on mismatched lengths; the guard has to come first.
    expect(tokensMatch('abc', 'abcdef')).toBe(false);
  });
});
