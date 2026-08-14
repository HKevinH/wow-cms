import type { AdapterCapability, SettingsSchema } from '@wowcms/contracts';
import type { Migration } from './migration';

export interface PermissionDefinition {
  /** Namespaced by module, e.g. 'armory.view'. */
  readonly key: string;
  readonly description: string;
}

export interface DashboardSection {
  readonly path: string;
  readonly title: string;
  readonly permission: string;
  /** Ordering hint for the sidebar. Lower sorts first; equal values fall back to
   *  the order modules were registered in. */
  readonly order?: number;
}

/** Everything a module contributes. Declared, never wired by hand. */
export interface WowCmsModule {
  /** Stable id, and the namespace for this module's routes, permissions and tables. */
  readonly id: string;
  readonly version: string;

  /** What it cannot run without. Checked at startup, not at request time. */
  readonly requires?: {
    readonly capabilities?: readonly AdapterCapability[];
    readonly modules?: readonly string[];
  };

  readonly permissions?: readonly PermissionDefinition[];
  readonly dashboard?: readonly DashboardSection[];

  /** The module's own tables, applied by the platform's runner at startup. Every
   *  table a module creates is prefixed with its id, so two modules cannot
   *  collide and uninstalling one is a comprehensible operation. */
  readonly migrations?: readonly Migration[];

  /** What an administrator can configure. The platform renders the form and
   *  stores the strings; the module reads them back through its own schema. */
  readonly settings?: SettingsSchema;

  /** A NestJS module class, mounted under /api/m/<id>. Typed as unknown here so the
   *  SDK stays free of a NestJS dependency; the API narrows it when mounting. */
  readonly api?: unknown;
}
