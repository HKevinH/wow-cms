import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  OWNER_ROLE,
  SESSION_TTL_SECONDS,
  WILDCARD_PERMISSION,
  type AccountId,
  type Role,
  type Viewer,
} from '@wowcms/contracts';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Username or password is incorrect.');
    this.name = 'InvalidCredentialsError';
  }
}

export interface StoredSession {
  readonly tokenHash: string;
  readonly accountId: AccountId;
  readonly username: string;
  readonly expiresAt: Date;
}

/** What the service needs from the emulator. Supplied by the accounts adapter, so
 *  nothing here knows how a 5.4.8 password is hashed. */
export interface CredentialChecker {
  verify(username: string, password: string): Promise<AccountId | null>;
}

/** What the service needs from the CMS database. An interface rather than the
 *  repository class so the rules below can be tested without a MySQL. */
export interface AuthStore {
  createSession(session: StoredSession): Promise<void>;
  findSession(tokenHash: string): Promise<StoredSession | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<number>;

  rolesOf(accountId: AccountId): Promise<Role[]>;
  countRoles(): Promise<number>;
  createRole(name: string, description: string, permissions: readonly string[]): Promise<number>;
  grantRole(accountId: AccountId, roleId: number): Promise<void>;
}

/** A session token: 32 random bytes, hex. Long enough that guessing is not a
 *  strategy, opaque so it carries no claim a server has to trust. */
function newToken(): string {
  return randomBytes(32).toString('hex');
}

/** Tokens are looked up by hash, so what the database holds cannot be replayed.
 *  SHA-256 without a work factor is right here and would be wrong for a password:
 *  this input is 256 bits of randomness, so there is no dictionary to run. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Compares two hex hashes without leaking where they first differ. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export class AuthService {
  constructor(
    private readonly credentials: CredentialChecker,
    private readonly store: AuthStore,
    /** Injected so expiry can be tested without waiting a week. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Verifies a game password and opens a session.
   *
   *  Returns the raw token, which the caller sets as a cookie and then forgets;
   *  this is the only moment it exists outside the browser. */
  async login(username: string, password: string): Promise<{ token: string; session: StoredSession }> {
    const accountId = await this.credentials.verify(username, password);
    if (accountId === null) {
      throw new InvalidCredentialsError();
    }

    await this.bootstrapOwner(accountId);

    const token = newToken();
    const session: StoredSession = {
      tokenHash: hashToken(token),
      accountId,
      username: username.toUpperCase(),
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_SECONDS * 1000),
    };

    await this.store.createSession(session);
    return { token, session };
  }

  /** A fresh install has no roles, so nobody could ever reach the administration
   *  area. The first account that proves it owns a game password is granted
   *  ownership — the same bargain every self-hosted CMS makes on first run, and
   *  the window closes as soon as one role exists. */
  private async bootstrapOwner(accountId: AccountId): Promise<void> {
    if ((await this.store.countRoles()) > 0) return;

    const roleId = await this.store.createRole(
      OWNER_ROLE,
      'Granted to the first account that logged in. Holds every permission.',
      [WILDCARD_PERMISSION],
    );
    await this.store.grantRole(accountId, roleId);
  }

  /** Resolves a cookie to a viewer, or to null. An expired session is deleted on
   *  the way past: the sweep is cheap here and means a dead row does not sit
   *  around until someone remembers to run a cleanup. */
  async resolve(token: string | undefined): Promise<Viewer | null> {
    if (!token) return null;

    const session = await this.store.findSession(hashToken(token));
    if (session === null) return null;

    if (session.expiresAt.getTime() <= this.now().getTime()) {
      await this.store.deleteSession(session.tokenHash);
      return null;
    }

    const roles = await this.store.rolesOf(session.accountId);

    return {
      accountId: session.accountId,
      username: session.username,
      roles: roles.map((role) => role.name),
      permissions: [...new Set(roles.flatMap((role) => role.permissions))],
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.store.deleteSession(hashToken(token));
  }

  /** Housekeeping, run on a timer by the platform. Sessions expire whether or not
   *  this runs — it only stops the table growing without bound. */
  sweep(): Promise<number> {
    return this.store.deleteExpiredSessions(this.now());
  }
}
