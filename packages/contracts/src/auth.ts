import type { AccountId } from './index';

/** Permission keys the platform itself owns. Modules add their own, namespaced by
 *  module id; these are the ones with no module behind them. */
export const CORE_PERMISSIONS = [
  'admin.access',
  'accounts.manage',
  'roles.manage',
  'settings.manage',
] as const;

/** The role a fresh install grants to whoever logs in first. Without it a new
 *  deployment has an administration area that nobody can ever open. */
export const OWNER_ROLE = 'owner';

/** Grants everything, including permissions from modules installed later. Checked
 *  by name rather than by an expanded list for exactly that reason. */
export const WILDCARD_PERMISSION = '*';

export interface Role {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly string[];
}

/** Who is making a request. Built once per request from the session cookie. */
export interface Viewer {
  readonly accountId: AccountId;
  readonly username: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface SessionInfo {
  readonly accountId: AccountId;
  readonly username: string;
  readonly expiresAt: string;
}

/** What /session returns to the browser. The token itself never appears here: it
 *  lives in an HttpOnly cookie so script on the page cannot read it. */
export interface SessionResponse {
  readonly viewer: Viewer;
  readonly expiresAt: string;
}

export const SESSION_COOKIE = 'wowcms_session';

/** Long enough that an administrator is not logging in twice a day, short enough
 *  that a forgotten session on a shared machine expires on its own. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function hasPermission(viewer: Viewer | null, permission: string): boolean {
  if (viewer === null) return false;
  return (
    viewer.permissions.includes(WILDCARD_PERMISSION) || viewer.permissions.includes(permission)
  );
}

/** An account as the administration list shows it. Deliberately not the whole
 *  emulator row: the CMS has no business displaying password material. */
export interface AccountSummary {
  readonly id: AccountId;
  readonly username: string;
  readonly email: string;
  readonly roles: readonly string[];
}
