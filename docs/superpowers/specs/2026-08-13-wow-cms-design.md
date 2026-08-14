# WoW CMS — Design

**Status:** approved in outline, pending review of the written form
**Date:** 2026-08-13

## What this is

A CMS for World of Warcraft private servers, in the spirit of FusionGEN but rebuilt
as a module platform rather than a fixed set of features. FusionGEN ships 31 modules
welded into a CodeIgniter application; the point here is that the armory, the store
and everything else are *plugins written against a public contract*, and the platform
is the product.

Version 1 targets TrinityCore 5.4.8. Support for other cores is a structural promise,
not a v1 feature: the seams are designed in, one adapter is implemented.

## Scope

In: account registration and management, public content, armory, store and donations,
server status, and an administration dashboard — each as a module on a common
platform.

Out of v1: adapters for cores other than TrinityCore 5.4.8, loading modules from npm
at runtime, and the launcher itself (the API is designed for it; the client is a
separate project).

## Architecture

A monorepo, pnpm workspaces, at `D:\Projects\wow-cms`:

```
wow-cms/
├─ apps/
│  ├─ api/            NestJS on Fastify — all business logic
│  └─ web/            Astro — public site and dashboard
├─ packages/
│  ├─ contracts/      Types and DTOs shared by api, web and future clients
│  ├─ module-sdk/     The public module contract
│  └─ core-adapters/  One package per emulator family (v1: trinity-5.4.8)
└─ modules/
   ├─ accounts/  content/  armory/  store/  status/
```

The API is a separate service from the web because it has more than one consumer: a
launcher is planned. Without that, a single Astro SSR deployment would have been the
better trade — a separate API costs two deployments and an authentication boundary,
and buys nothing until a second client exists.

`contracts` is its own package for the same reason. Types that live inside
`apps/api` get copied into the launcher and drift.

`modules/` sits outside `apps/` because a module contributes to both sides: API
routes and dashboard sections. Filing them under the API would define the module
system as backend-only, and the armory could then never ship its own interface.

Dependency direction: modules depend on `module-sdk`, never on `apps/api`. That
single arrow is what makes the contract real rather than decorative.

## The module contract

```ts
/** Everything a module contributes. Declared, never wired by hand. */
export interface WowCmsModule {
  /** Stable id. Also the namespace for its routes, permissions and tables. */
  readonly id: string;
  readonly version: string;

  /** What it cannot run without. Checked at startup, not at request time. */
  readonly requires?: {
    capabilities?: AdapterCapability[];
    modules?: string[];
  };

  readonly permissions?: PermissionDefinition[];
  readonly settings?: SettingsSchema;
  readonly migrations?: Migration[];

  readonly api?: Type<unknown>;              // NestJS module, mounted at /api/m/<id>
  readonly dashboard?: DashboardSection[];
}

/** What the core hands a module. Nothing else is reachable. */
export interface ModuleContext {
  readonly game: GameDataAdapter;   // the only door to auth/characters/world
  readonly db: ScopedDatabase;      // CMS database, limited to this module's tables
  readonly cache: CacheService;
  readonly settings: SettingsReader;
  readonly logger: Logger;
}
```

Four rules hold this up:

**No module touches the emulator databases.** Only `game` exists. A module writing
`SELECT ... FROM characters` by hand would marry itself to one schema and make the
multi-core claim false.

**`requires.capabilities` is checked at startup.** A module needing guild data on a
core that does not expose it fails to boot with a clear message, rather than
throwing months later when someone opens that page.

**`db` is limited to the module's own tables**, by prefix. Without it, the first
third-party module that writes into another's tables turns upgrades into a lottery.

**Migrations are recorded per module**, so uninstalling knows what to reverse.

Deliberately absent from the contract: filesystem access, arbitrary SQL, and
overriding another module's routes. Those are the three doors through which plugin
systems decay until the core can no longer be updated.

## Data layer

Four connections: `auth`, `characters` and `world` belong to the emulator; the CMS
database is ours.

### Schema discovery over hardcoded SQL

Table and column names are never embedded in queries. At startup the platform reads
`INFORMATION_SCHEMA` and builds a probe; adapters score how well they recognise what
they find; the winner supplies a default field map that configuration may override
entry by entry.

```ts
/** Read from INFORMATION_SCHEMA at startup. Nothing is assumed to exist. */
export interface SchemaProbe {
  hasTable(db: GameDatabase, table: string): boolean;
  hasColumn(db: GameDatabase, table: string, column: string): boolean;
  columnType(db: GameDatabase, table: string, column: string): string | null;
}

/** Declarative mapping. Adapters ship defaults; config overrides any entry without
 *  code changes, for schemas that drifted from the stock layout. */
export interface FieldMap {
  accounts: { table: string; id: string; username: string; passwordHash: string; email: string };
  characters: { table: string; name: string; level: string; race: string; class: string };
}

/** Highest score wins. The choice is logged so a wrong guess is visible. */
export interface CoreAdapter {
  detect(probe: SchemaProbe): number;   // 0 = not mine, 100 = certain
  readonly defaultFieldMap: FieldMap;
}
```

Discovery has a hard limit worth stating: **shape is not semantics**. Seeing
`sha_pass_hash varchar(40)` does not reveal what algorithm produced it. So adapters
survive, but thin: they carry the algorithms and rules introspection cannot guess,
while the field map carries the layout.

A diagnostics page in the dashboard reports what was detected — chosen adapter, its
score, active capabilities, and what is missing for the inactive ones. For a CMS
other people install, that turns "it does not work" into a readable report.

### Access rules

These follow from a specific risk: the emulator is using these databases *while the
website queries them*, and a slow web query degrades the game.

- **Game databases are read-only**, with one exception: writing to `account` on
  registration and password change.
- **A separate, capped connection pool** (5 connections) for emulator databases. If
  the site saturates it, the site stalls — the worldserver never starves.
- **Cache in front of everything that reads game data.** Seconds for status and
  online counts, minutes for armory and PvP ladders.

Rendering was never the scaling concern. Query patterns against the live game
databases are.

## Accounts and authentication

Verified against a running 5.4.8 server rather than assumed:

```
auth.account: sha_pass_hash varchar(40), v varchar(64), s varchar(64)
```

```cpp
// AccountMgr.cpp:337
SHA1( normalizeString(username) + ":" + normalizeString(password) )  -> 40 hex
```

Password changes run `UPDATE account SET v = 0, s = 0, sha_pass_hash = ?`; the server
recomputes the SRP6 verifier and salt on the next login.

So registration on this core is **SHA1 and nothing more** — no bignum arithmetic, no
verifier derivation. The risk that justifies a dedicated `FusionGen-SRP6` project
does not apply here. Modern TrinityCore, with real `salt` and `verifier` columns,
would need that work; its adapter can add it without disturbing anything else.

`normalizeString` uppercases (Latin only) both username and password before hashing.
Replicating it inexactly produces a login failure with an unhelpful message, so this
is covered by a round-trip test: create an account through the CMS, authenticate it
through the core, compare.

All of this lives in the adapter. The accounts module asks for an account; how it is
hashed is not its business.

Sessions use JWT with refresh tokens, so the web app and the planned launcher share
one mechanism instead of two.

## Dashboard and permissions

Permissions are strings namespaced by module (`armory.view`, `store.refund`), each
declared by the module that owns it. Roles are collections of permissions, editable
in the dashboard; the editor is built from whatever the loaded modules declared, so
installing a module makes its permissions appear without any core change.

The dashboard is an Astro area under `/admin`, assembled from the `dashboard`
sections modules contribute. The core supplies only the shell — navigation, auth,
the role editor, the diagnostics page and module management. Every functional screen
belongs to a module, which keeps the core from quietly growing features that should
have been plugins.

## Error handling

Two rules, both learned the hard way on the emulator this design connects to:

**Fail at startup, loudly, with the cause named.** Missing capability, unreadable
schema, unreachable database — none of these should become a runtime surprise on a
page nobody visits for a month.

**Never let a module's failure take down the platform.** A module that throws during
request handling returns an error for its own routes; the rest of the site keeps
serving. A module that fails its startup checks is disabled and reported on the
diagnostics page, not fatal to boot.

## Testing

- **Adapter round-trip tests against a real database** are the ones that matter. The
  password hash test above is the template: produce a value, have the emulator accept
  it, assert. Anything mocked here tests our beliefs about the schema rather than the
  schema.
- **Contract tests for the module SDK**, run against every first-party module, so the
  five initial modules keep the contract honest before third parties see it.
- **Unit tests** for pure logic: field-map resolution, adapter scoring, permission
  evaluation.

## Open questions

None blocking. The next artifact is the implementation plan.
