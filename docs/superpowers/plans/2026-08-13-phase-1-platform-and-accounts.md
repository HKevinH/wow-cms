# Phase 1 — Platform and Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user registers on the website and logs into a live TrinityCore 5.4.8 game server with that account, while an administrator sees which emulator schema was detected.

**Architecture:** A pnpm monorepo. All emulator access goes through an adapter chosen at startup by introspecting `INFORMATION_SCHEMA`, never through hardcoded SQL. Features are modules declared against a public contract; Phase 1 ships the platform plus one module (accounts) to prove the contract against something real.

**Tech Stack:** TypeScript, Node 24, pnpm 10, NestJS on Fastify, Astro, mysql2, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-wow-cms-design.md`

## Global Constraints

- Node >= 20, pnpm >= 10. Verified available: Node v24.15.0, pnpm 10.33.2.
- All code comments and identifiers in English.
- No SQL may contain a hardcoded emulator table or column name. Every emulator query builds its identifiers from a `FieldMap`. This is the rule the whole design rests on; a reviewer should reject any task that breaks it.
- The emulator databases (`auth`, `characters`, `world`) are read-only except writes to the accounts table on registration and password change.
- The emulator connection pool is capped at 5 connections so the website can never starve the worldserver.
- Integration tests need a live MySQL holding a TrinityCore 5.4.8 schema. They read `WOWCMS_TEST_AUTH_URL`; when it is unset they skip rather than fail, so the suite stays green on a machine without a server.

---

## File Structure

| Path | Responsibility |
|---|---|
| `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `vitest.config.ts` | Workspace, shared compiler and test configuration |
| `packages/contracts/src/index.ts` | Domain types shared by API, web and future launcher |
| `packages/core-adapters/src/schema-probe.ts` | Reads `INFORMATION_SCHEMA`; answers what exists |
| `packages/core-adapters/src/field-map.ts` | Declarative table/column mapping and config overrides |
| `packages/core-adapters/src/registry.ts` | Scores adapters against a probe, picks the winner |
| `packages/core-adapters/src/trinity-548/password.ts` | The 5.4.8 password hash, isolated because it is the riskiest rule |
| `packages/core-adapters/src/trinity-548/adapter.ts` | The 5.4.8 adapter: field map defaults, detection, account operations |
| `packages/core-adapters/src/pool.ts` | Capped, read-mostly connection pool for emulator databases |
| `packages/module-sdk/src/module.ts` | `WowCmsModule` and `ModuleContext` — the public contract |
| `packages/module-sdk/src/registry.ts` | Loads modules, enforces capability requirements at startup |
| `apps/api/src/main.ts`, `apps/api/src/app.module.ts` | NestJS bootstrap on Fastify, configuration, module mounting |
| `apps/api/src/diagnostics/diagnostics.controller.ts` | Reports detected adapter, score and capabilities |
| `modules/accounts/src/index.ts`, `accounts.controller.ts`, `accounts.service.ts` | Registration and login as the first real module |
| `apps/web/src/pages/register.astro`, `login.astro`, `admin/diagnostics.astro` | Public pages and the dashboard shell |

Password hashing lives in its own file because it is the one rule that silently breaks logins when wrong, and it must be readable on its own to be reviewed against the C++ source.

---

## Task 1: Monorepo skeleton and test harness

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Test: `packages/contracts/src/index.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a workspace where `pnpm test` runs Vitest across all packages, and `@wowcms/contracts` resolves as a workspace dependency.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONTRACTS_VERSION } from './index';

describe('contracts package', () => {
  it('exposes a version the API and clients can compare against', () => {
    expect(CONTRACTS_VERSION).toBe('1.0.0');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/contracts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Create the workspace files**

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'modules/*'
```

`package.json`:

```json
{
  "name": "wow-cms",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests talk to a real MySQL and are slower than unit tests.
    testTimeout: 15_000,
  },
});
```

`.gitignore`:

```
node_modules/
dist/
*.log
.env
```

`packages/contracts/package.json`:

```json
{
  "name": "@wowcms/contracts",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

`packages/contracts/src/index.ts`:

```ts
/** Bumped when a breaking change reaches the shared types, so a launcher built
 *  against an older API can refuse to start instead of misbehaving. */
export const CONTRACTS_VERSION = '1.0.0';
```

- [ ] **Step 4: Install and run the test**

Run: `pnpm install && pnpm test`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: set up the pnpm workspace and test harness"
```

---

## Task 2: Domain types

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/index.test.ts`

**Interfaces:**
- Consumes: `CONTRACTS_VERSION` from Task 1.
- Produces: `AccountId`, `NewAccount`, `AdapterCapability`, `AdapterReport` — used by every later task.

- [ ] **Step 1: Write the failing test**

Append to `packages/contracts/src/index.test.ts`:

```ts
import { ADAPTER_CAPABILITIES } from './index';

describe('adapter capabilities', () => {
  it('lists the capabilities a module may require', () => {
    expect(ADAPTER_CAPABILITIES).toContain('accounts');
    expect(ADAPTER_CAPABILITIES).toContain('characters');
    expect(ADAPTER_CAPABILITIES).toContain('guilds');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/contracts`
Expected: FAIL — `ADAPTER_CAPABILITIES` is not exported.

- [ ] **Step 3: Add the types**

Append to `packages/contracts/src/index.ts`:

```ts
/** Capabilities a core may or may not offer. A module declares what it needs and
 *  the platform refuses to start it when the detected core lacks it. */
export const ADAPTER_CAPABILITIES = ['accounts', 'characters', 'guilds', 'items'] as const;

export type AdapterCapability = (typeof ADAPTER_CAPABILITIES)[number];

export type AccountId = number;

export interface NewAccount {
  readonly username: string;
  readonly password: string;
  readonly email: string;
}

/** What the diagnostics page shows: which adapter won, how sure it was, and what
 *  that leaves working. */
export interface AdapterReport {
  readonly adapterId: string;
  readonly score: number;
  readonly capabilities: readonly AdapterCapability[];
  readonly missing: readonly string[];
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contracts): add the domain types shared across the platform"
```

---

## Task 3: Schema probe

**Files:**
- Create: `packages/core-adapters/package.json`, `packages/core-adapters/src/schema-probe.ts`
- Test: `packages/core-adapters/src/schema-probe.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SchemaProbe` with `hasTable(table)`, `hasColumn(table, column)`, `columnType(table, column)`, and `buildSchemaProbe(connection, databaseName): Promise<SchemaProbe>`.

- [ ] **Step 1: Write the failing test**

Create `packages/core-adapters/src/schema-probe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SchemaProbe } from './schema-probe';

describe('SchemaProbe', () => {
  const probe = new SchemaProbe([
    { table: 'account', column: 'username', type: 'varchar' },
    { table: 'account', column: 'sha_pass_hash', type: 'varchar' },
  ]);

  it('reports tables it saw', () => {
    expect(probe.hasTable('account')).toBe(true);
    expect(probe.hasTable('battlenet_accounts')).toBe(false);
  });

  it('reports columns it saw', () => {
    expect(probe.hasColumn('account', 'sha_pass_hash')).toBe(true);
    expect(probe.hasColumn('account', 'verifier')).toBe(false);
  });

  it('is case-insensitive, because MySQL identifiers may differ in case', () => {
    expect(probe.hasColumn('ACCOUNT', 'Sha_Pass_Hash')).toBe(true);
  });

  it('returns the column type, or null when absent', () => {
    expect(probe.columnType('account', 'username')).toBe('varchar');
    expect(probe.columnType('account', 'verifier')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core-adapters`
Expected: FAIL — cannot resolve `./schema-probe`.

- [ ] **Step 3: Implement the probe**

`packages/core-adapters/package.json`:

```json
{
  "name": "@wowcms/core-adapters",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@wowcms/contracts": "workspace:*",
    "mysql2": "^3.11.0"
  }
}
```

`packages/core-adapters/src/schema-probe.ts`:

```ts
export interface ColumnRecord {
  readonly table: string;
  readonly column: string;
  readonly type: string;
}

/** Answers what a live database actually contains. Built once at startup so no
 *  request pays for introspection, and so a missing column is reported then
 *  rather than discovered by whoever opens the wrong page months later. */
export class SchemaProbe {
  private readonly columns = new Map<string, string>();
  private readonly tables = new Set<string>();

  constructor(records: readonly ColumnRecord[]) {
    for (const record of records) {
      this.tables.add(record.table.toLowerCase());
      this.columns.set(SchemaProbe.key(record.table, record.column), record.type.toLowerCase());
    }
  }

  private static key(table: string, column: string): string {
    return `${table.toLowerCase()}.${column.toLowerCase()}`;
  }

  hasTable(table: string): boolean {
    return this.tables.has(table.toLowerCase());
  }

  hasColumn(table: string, column: string): boolean {
    return this.columns.has(SchemaProbe.key(table, column));
  }

  columnType(table: string, column: string): string | null {
    return this.columns.get(SchemaProbe.key(table, column)) ?? null;
  }
}

/** Minimal shape of a mysql2 connection, so tests need no live database. */
export interface QueryableConnection {
  query(sql: string, values: unknown[]): Promise<[unknown[], unknown]>;
}

export async function buildSchemaProbe(
  connection: QueryableConnection,
  databaseName: string,
): Promise<SchemaProbe> {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS d ' +
      'FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?',
    [databaseName],
  );

  const records = (rows as Array<{ t: string; c: string; d: string }>).map((row) => ({
    table: row.t,
    column: row.c,
    type: row.d,
  }));

  return new SchemaProbe(records);
}
```

`packages/core-adapters/src/index.ts`:

```ts
export * from './schema-probe';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(adapters): read the live schema instead of assuming one"
```

---

## Task 4: Field map and adapter registry

**Files:**
- Create: `packages/core-adapters/src/field-map.ts`, `packages/core-adapters/src/registry.ts`
- Modify: `packages/core-adapters/src/index.ts`
- Test: `packages/core-adapters/src/registry.test.ts`

**Interfaces:**
- Consumes: `SchemaProbe` from Task 3.
- Produces: `FieldMap`, `applyFieldMapOverrides(base, overrides)`, `CoreAdapter` interface with `id`, `detect(probe)`, `defaultFieldMap`, and `selectAdapter(adapters, probe)` returning `{ adapter, score }` or throwing.

- [ ] **Step 1: Write the failing test**

Create `packages/core-adapters/src/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SchemaProbe } from './schema-probe';
import { applyFieldMapOverrides, type FieldMap } from './field-map';
import { selectAdapter, type CoreAdapter } from './registry';

const baseMap: FieldMap = {
  accounts: {
    table: 'account',
    id: 'id',
    username: 'username',
    passwordHash: 'sha_pass_hash',
    email: 'email',
  },
};

const strong: CoreAdapter = { id: 'strong', detect: () => 90, defaultFieldMap: baseMap };
const weak: CoreAdapter = { id: 'weak', detect: () => 10, defaultFieldMap: baseMap };
const absent: CoreAdapter = { id: 'absent', detect: () => 0, defaultFieldMap: baseMap };

const probe = new SchemaProbe([{ table: 'account', column: 'username', type: 'varchar' }]);

describe('selectAdapter', () => {
  it('picks the highest scoring adapter', () => {
    expect(selectAdapter([weak, strong], probe).adapter.id).toBe('strong');
  });

  it('reports the winning score so a weak match is visible', () => {
    expect(selectAdapter([weak, strong], probe).score).toBe(90);
  });

  it('throws when no adapter recognises the schema, naming the problem', () => {
    expect(() => selectAdapter([absent], probe)).toThrow(/no adapter recognised/i);
  });
});

describe('applyFieldMapOverrides', () => {
  it('replaces only the entries given', () => {
    const merged = applyFieldMapOverrides(baseMap, { accounts: { table: 'accounts' } });
    expect(merged.accounts.table).toBe('accounts');
    expect(merged.accounts.username).toBe('username');
  });

  it('leaves the base map untouched', () => {
    applyFieldMapOverrides(baseMap, { accounts: { table: 'accounts' } });
    expect(baseMap.accounts.table).toBe('account');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core-adapters`
Expected: FAIL — cannot resolve `./field-map`.

- [ ] **Step 3: Implement both files**

`packages/core-adapters/src/field-map.ts`:

```ts
/** Where the emulator keeps things. Adapters ship defaults; deployments override
 *  individual entries from configuration when their schema has drifted, so a
 *  patched server needs a config edit rather than a fork. */
export interface FieldMap {
  readonly accounts: {
    readonly table: string;
    readonly id: string;
    readonly username: string;
    readonly passwordHash: string;
    readonly email: string;
  };
}

export type FieldMapOverrides = {
  readonly [S in keyof FieldMap]?: Partial<FieldMap[S]>;
};

export function applyFieldMapOverrides(base: FieldMap, overrides: FieldMapOverrides): FieldMap {
  return {
    accounts: { ...base.accounts, ...overrides.accounts },
  };
}
```

`packages/core-adapters/src/registry.ts`:

```ts
import type { SchemaProbe } from './schema-probe';
import type { FieldMap } from './field-map';

export interface CoreAdapter {
  readonly id: string;
  /** How well this adapter recognises the live schema: 0 means not mine, 100 certain. */
  detect(probe: SchemaProbe): number;
  readonly defaultFieldMap: FieldMap;
}

export interface AdapterSelection {
  readonly adapter: CoreAdapter;
  readonly score: number;
}

/** Picks the best match and reports the score, so a weak guess is visible on the
 *  diagnostics page rather than silently driving every query. */
export function selectAdapter(
  adapters: readonly CoreAdapter[],
  probe: SchemaProbe,
): AdapterSelection {
  let best: AdapterSelection | null = null;

  for (const adapter of adapters) {
    const score = adapter.detect(probe);
    if (score > 0 && (best === null || score > best.score)) {
      best = { adapter, score };
    }
  }

  if (best === null) {
    throw new Error(
      'No adapter recognised the emulator schema. Check the database credentials point at ' +
        'an auth database, or add an adapter for this core.',
    );
  }

  return best;
}
```

Replace `packages/core-adapters/src/index.ts`:

```ts
export * from './schema-probe';
export * from './field-map';
export * from './registry';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(adapters): score adapters against the live schema"
```

---

## Task 5: The TrinityCore 5.4.8 password rule

**Files:**
- Create: `packages/core-adapters/src/trinity-548/password.ts`
- Test: `packages/core-adapters/src/trinity-548/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeForHash(value: string): string` and `shaPassHash(username: string, password: string): string`.

This is the highest-risk rule in the project. It reproduces `AccountMgr::CalculateShaPassHash`
and `AccountMgr::normalizeString` from TrinityCore 5.4.8:

```cpp
// AccountMgr.cpp:337
SHA1( normalizeString(username) + ":" + normalizeString(password) )  -> 40 lowercase hex
// normalizeString uppercases via wcharToUpperOnlyLatin, which changes ONLY a-z.
```

The "only Latin" detail matters. JavaScript's `toUpperCase()` also uppercases Cyrillic
and accented characters; the core does not. A Russian username would hash differently
and the login would fail with an unhelpful message.

- [ ] **Step 1: Write the failing test**

Create `packages/core-adapters/src/trinity-548/password.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeForHash, shaPassHash } from './password';

describe('normalizeForHash', () => {
  it('uppercases ASCII letters', () => {
    expect(normalizeForHash('Player')).toBe('PLAYER');
  });

  it('leaves non-Latin characters alone, matching wcharToUpperOnlyLatin', () => {
    // toUpperCase() would return 'ИГРОК' here and produce a different hash.
    expect(normalizeForHash('игрок')).toBe('игрок');
  });

  it('leaves accented Latin-1 characters alone', () => {
    expect(normalizeForHash('café')).toBe('CAFé');
  });

  it('leaves digits and punctuation untouched', () => {
    expect(normalizeForHash('user_01')).toBe('USER_01');
  });
});

describe('shaPassHash', () => {
  it('hashes uppercased USERNAME:PASSWORD as 40 lowercase hex characters', () => {
    const expected = createHash('sha1').update('TEST:SECRET', 'utf8').digest('hex');
    expect(shaPassHash('test', 'secret')).toBe(expected);
    expect(shaPassHash('test', 'secret')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is case-insensitive for both username and password', () => {
    expect(shaPassHash('Test', 'Secret')).toBe(shaPassHash('TEST', 'SECRET'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/core-adapters`
Expected: FAIL — cannot resolve `./password`.

- [ ] **Step 3: Implement the rule**

`packages/core-adapters/src/trinity-548/password.ts`:

```ts
import { createHash } from 'node:crypto';

/** Reproduces AccountMgr::normalizeString, which uppercases through
 *  wcharToUpperOnlyLatin - and that helper changes only basic Latin letters.
 *  String.prototype.toUpperCase() would also fold Cyrillic and accented
 *  characters, producing a hash the emulator never accepts. */
export function normalizeForHash(value: string): string {
  return value.replace(/[a-z]/g, (character) => character.toUpperCase());
}

/** Reproduces AccountMgr::CalculateShaPassHash for TrinityCore 5.4.8:
 *  SHA1 over the UTF-8 bytes of "USERNAME:PASSWORD", as 40 lowercase hex. */
export function shaPassHash(username: string, password: string): string {
  const material = `${normalizeForHash(username)}:${normalizeForHash(password)}`;
  return createHash('sha1').update(material, 'utf8').digest('hex');
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(adapters): reproduce the 5.4.8 password hash exactly"
```

---

## Task 6: The TrinityCore 5.4.8 adapter

**Files:**
- Create: `packages/core-adapters/src/pool.ts`, `packages/core-adapters/src/trinity-548/adapter.ts`
- Modify: `packages/core-adapters/src/index.ts`
- Test: `packages/core-adapters/src/trinity-548/adapter.test.ts`, `packages/core-adapters/src/trinity-548/adapter.integration.test.ts`

**Interfaces:**
- Consumes: `SchemaProbe` (Task 3), `CoreAdapter`/`FieldMap` (Task 4), `shaPassHash` (Task 5).
- Produces: `createEmulatorPool(url)`, and `Trinity548Adapter` implementing `CoreAdapter` plus `accounts.create(pool, map, input)`, `accounts.verifyPassword(pool, map, username, password)`.

- [ ] **Step 1: Write the failing unit test**

Create `packages/core-adapters/src/trinity-548/adapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SchemaProbe } from '../schema-probe';
import { trinity548Adapter } from './adapter';

const fullSchema = new SchemaProbe([
  { table: 'account', column: 'id', type: 'int' },
  { table: 'account', column: 'username', type: 'varchar' },
  { table: 'account', column: 'sha_pass_hash', type: 'varchar' },
  { table: 'account', column: 'email', type: 'varchar' },
]);

describe('trinity548Adapter.detect', () => {
  it('recognises a 5.4.8 auth schema with high confidence', () => {
    expect(trinity548Adapter.detect(fullSchema)).toBeGreaterThanOrEqual(80);
  });

  it('declines a schema with no account table', () => {
    expect(trinity548Adapter.detect(new SchemaProbe([]))).toBe(0);
  });

  it('declines a modern schema that uses verifier instead of sha_pass_hash', () => {
    const modern = new SchemaProbe([
      { table: 'account', column: 'id', type: 'int' },
      { table: 'account', column: 'username', type: 'varchar' },
      { table: 'account', column: 'verifier', type: 'blob' },
      { table: 'account', column: 'salt', type: 'blob' },
    ]);
    expect(trinity548Adapter.detect(modern)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/core-adapters`
Expected: FAIL — cannot resolve `./adapter`.

- [ ] **Step 3: Implement the pool and adapter**

`packages/core-adapters/src/pool.ts`:

```ts
import { createPool, type Pool } from 'mysql2/promise';

/** The worldserver is using these databases while the site queries them, so the
 *  site gets a small pool of its own. If the website saturates it the website
 *  stalls, which is survivable; starving the game server is not. */
export const EMULATOR_POOL_LIMIT = 5;

export function createEmulatorPool(url: string): Pool {
  return createPool({ uri: url, connectionLimit: EMULATOR_POOL_LIMIT, namedPlaceholders: false });
}
```

`packages/core-adapters/src/trinity-548/adapter.ts`:

```ts
import type { Pool } from 'mysql2/promise';
import type { AccountId, NewAccount } from '@wowcms/contracts';
import type { SchemaProbe } from '../schema-probe';
import type { CoreAdapter, FieldMap } from '../index';
import { shaPassHash } from './password';

const defaultFieldMap: FieldMap = {
  accounts: {
    table: 'account',
    id: 'id',
    username: 'username',
    passwordHash: 'sha_pass_hash',
    email: 'email',
  },
};

/** Wraps an identifier in backticks and rejects anything that is not a plain
 *  identifier, so a field map coming from configuration cannot inject SQL. */
function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier in field map: ${name}`);
  }
  return `\`${name}\``;
}

export const trinity548Adapter: CoreAdapter = {
  id: 'trinity-5.4.8',
  defaultFieldMap,

  detect(probe: SchemaProbe): number {
    if (!probe.hasTable('account')) return 0;
    // Modern cores replaced the hash column with verifier/salt; this adapter's
    // password rule would be wrong for them, so it declines rather than guesses.
    if (probe.hasColumn('account', 'verifier')) return 0;
    if (!probe.hasColumn('account', 'sha_pass_hash')) return 0;

    let score = 80;
    if (probe.hasColumn('account', 's') && probe.hasColumn('account', 'v')) score += 10;
    if (probe.hasColumn('account', 'battlenet_account')) score += 10;
    return score;
  },
};

export async function createAccount(
  pool: Pool,
  map: FieldMap,
  input: NewAccount,
): Promise<AccountId> {
  const table = quoteIdentifier(map.accounts.table);
  const username = quoteIdentifier(map.accounts.username);
  const hash = quoteIdentifier(map.accounts.passwordHash);
  const email = quoteIdentifier(map.accounts.email);

  const [result] = await pool.execute(
    `INSERT INTO ${table} (${username}, ${hash}, ${email}) VALUES (?, ?, ?)`,
    [
      input.username.toUpperCase(),
      shaPassHash(input.username, input.password),
      input.email,
    ],
  );

  return (result as { insertId: number }).insertId;
}

export async function verifyPassword(
  pool: Pool,
  map: FieldMap,
  username: string,
  password: string,
): Promise<AccountId | null> {
  const table = quoteIdentifier(map.accounts.table);
  const idColumn = quoteIdentifier(map.accounts.id);
  const usernameColumn = quoteIdentifier(map.accounts.username);
  const hashColumn = quoteIdentifier(map.accounts.passwordHash);

  const [rows] = await pool.execute(
    `SELECT ${idColumn} AS id FROM ${table} WHERE ${usernameColumn} = ? AND ${hashColumn} = ?`,
    [username.toUpperCase(), shaPassHash(username, password)],
  );

  const found = (rows as Array<{ id: number }>)[0];
  return found ? found.id : null;
}
```

Append to `packages/core-adapters/src/index.ts`:

```ts
export * from './pool';
export * from './trinity-548/password';
export * from './trinity-548/adapter';
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm test`
Expected: PASS, 20 tests.

- [ ] **Step 5: Write the round-trip integration test**

This is the test the spec calls the one that matters: a hash this code produces must be
one the emulator accepts. It compares against the value already stored by the running
server for a known account, so it validates against the C++ implementation rather than
against our own belief about it.

Create `packages/core-adapters/src/trinity-548/adapter.integration.test.ts`:

```ts
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
```

- [ ] **Step 6: Run the integration test against the live server**

Run:

```bash
WOWCMS_TEST_AUTH_URL="mysql://root:root@127.0.0.1:3306/auth" pnpm vitest run packages/core-adapters
```

Expected: PASS, including the two integration tests.

Then confirm by hand that the account works in the game client: register through the
test above with a fixed username, and log in. A green test with a failed login means
the rule is self-consistent but wrong, which is exactly what this task exists to catch.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(adapters): implement the TrinityCore 5.4.8 adapter"
```

---

## Task 7: The module contract and registry

**Files:**
- Create: `packages/module-sdk/package.json`, `packages/module-sdk/src/module.ts`, `packages/module-sdk/src/registry.ts`, `packages/module-sdk/src/index.ts`
- Test: `packages/module-sdk/src/registry.test.ts`

**Interfaces:**
- Consumes: `AdapterCapability` from Task 2.
- Produces: `WowCmsModule`, `ModuleContext`, and `resolveModules(modules, available)` returning `{ enabled, disabled }` where each disabled entry carries a human-readable reason.

- [ ] **Step 1: Write the failing test**

Create `packages/module-sdk/src/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveModules } from './registry';
import type { WowCmsModule } from './module';

const accounts: WowCmsModule = { id: 'accounts', version: '1.0.0' };
const armory: WowCmsModule = {
  id: 'armory',
  version: '1.0.0',
  requires: { capabilities: ['characters'] },
};
const guilds: WowCmsModule = {
  id: 'guilds',
  version: '1.0.0',
  requires: { capabilities: ['guilds'] },
};
const store: WowCmsModule = {
  id: 'store',
  version: '1.0.0',
  requires: { modules: ['accounts'] },
};
const orphan: WowCmsModule = {
  id: 'orphan',
  version: '1.0.0',
  requires: { modules: ['missing'] },
};

describe('resolveModules', () => {
  it('enables a module whose capabilities are available', () => {
    const result = resolveModules([armory], ['accounts', 'characters']);
    expect(result.enabled.map((m) => m.id)).toEqual(['armory']);
  });

  it('disables a module whose capability is missing, naming it', () => {
    const result = resolveModules([guilds], ['accounts', 'characters']);
    expect(result.enabled).toHaveLength(0);
    expect(result.disabled[0]?.reason).toContain('guilds');
  });

  it('enables a module whose required module is present', () => {
    const result = resolveModules([accounts, store], ['accounts']);
    expect(result.enabled.map((m) => m.id)).toEqual(['accounts', 'store']);
  });

  it('disables a module whose required module is absent, naming it', () => {
    const result = resolveModules([orphan], ['accounts']);
    expect(result.disabled[0]?.reason).toContain('missing');
  });

  it('rejects two modules claiming the same id', () => {
    expect(() => resolveModules([accounts, accounts], ['accounts'])).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/module-sdk`
Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Implement the contract and registry**

`packages/module-sdk/package.json`:

```json
{
  "name": "@wowcms/module-sdk",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "@wowcms/contracts": "workspace:*" }
}
```

`packages/module-sdk/src/module.ts`:

```ts
import type { AdapterCapability } from '@wowcms/contracts';

export interface PermissionDefinition {
  /** Namespaced by module, e.g. 'armory.view'. */
  readonly key: string;
  readonly description: string;
}

export interface DashboardSection {
  readonly path: string;
  readonly title: string;
  readonly permission: string;
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

  /** A NestJS module class, mounted under /api/m/<id>. Typed as unknown here so the
   *  SDK stays free of a NestJS dependency; the API narrows it when mounting. */
  readonly api?: unknown;
}
```

`packages/module-sdk/src/registry.ts`:

```ts
import type { AdapterCapability } from '@wowcms/contracts';
import type { WowCmsModule } from './module';

export interface DisabledModule {
  readonly module: WowCmsModule;
  readonly reason: string;
}

export interface ResolvedModules {
  readonly enabled: readonly WowCmsModule[];
  readonly disabled: readonly DisabledModule[];
}

/** Decides at startup which modules can run against the detected core. A module
 *  that cannot is disabled and reported, never left to fail on a page nobody
 *  opens for a month. */
export function resolveModules(
  modules: readonly WowCmsModule[],
  available: readonly AdapterCapability[],
): ResolvedModules {
  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.id)) {
      throw new Error(`Duplicate module id: ${module.id}`);
    }
    seen.add(module.id);
  }

  const capabilities = new Set<string>(available);
  const enabled: WowCmsModule[] = [];
  const disabled: DisabledModule[] = [];
  const enabledIds = new Set<string>();

  for (const module of modules) {
    const missingCapability = module.requires?.capabilities?.find((c) => !capabilities.has(c));
    if (missingCapability !== undefined) {
      disabled.push({
        module,
        reason: `The detected core does not provide the '${missingCapability}' capability.`,
      });
      continue;
    }

    const missingModule = module.requires?.modules?.find(
      (id) => !enabledIds.has(id) && !modules.some((m) => m.id === id),
    );
    if (missingModule !== undefined) {
      disabled.push({ module, reason: `Requires module '${missingModule}', which is not installed.` });
      continue;
    }

    enabled.push(module);
    enabledIds.add(module.id);
  }

  return { enabled, disabled };
}
```

`packages/module-sdk/src/index.ts`:

```ts
export * from './module';
export * from './registry';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 25 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sdk): define the module contract and startup resolution"
```

---

## Task 8: API bootstrap and diagnostics endpoint

**Files:**
- Create: `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/platform/platform.service.ts`, `apps/api/src/diagnostics/diagnostics.controller.ts`
- Test: `apps/api/src/diagnostics/diagnostics.controller.test.ts`

**Interfaces:**
- Consumes: `selectAdapter`, `buildSchemaProbe`, `createEmulatorPool` (Tasks 3-6), `resolveModules` (Task 7).
- Produces: an HTTP service exposing `GET /api/diagnostics` returning `AdapterReport`, and `PlatformService.report()` for reuse.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/diagnostics/diagnostics.controller.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DiagnosticsController } from './diagnostics.controller';
import type { AdapterReport } from '@wowcms/contracts';

const report: AdapterReport = {
  adapterId: 'trinity-5.4.8',
  score: 100,
  capabilities: ['accounts'],
  missing: ['guilds: no guild_member table'],
};

describe('DiagnosticsController', () => {
  it('returns what the platform detected at startup', () => {
    const controller = new DiagnosticsController({ report: () => report });
    expect(controller.get()).toEqual(report);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/api`
Expected: FAIL — cannot resolve `./diagnostics.controller`.

- [ ] **Step 3: Implement the API**

`apps/api/package.json`:

```json
{
  "name": "@wowcms/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "node --experimental-strip-types src/main.ts" },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-fastify": "^10.4.0",
    "@wowcms/contracts": "workspace:*",
    "@wowcms/core-adapters": "workspace:*",
    "@wowcms/module-sdk": "workspace:*",
    "reflect-metadata": "^0.2.2"
  }
}
```

`apps/api/src/platform/platform.service.ts`:

```ts
import type { AdapterReport } from '@wowcms/contracts';

/** The narrow slice of the platform the diagnostics endpoint needs, so the
 *  controller can be tested without booting a database. */
export interface PlatformReporter {
  report(): AdapterReport;
}
```

`apps/api/src/diagnostics/diagnostics.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import type { AdapterReport } from '@wowcms/contracts';
import type { PlatformReporter } from '../platform/platform.service';

/** Turns "it does not work" into a readable report: which adapter won, how
 *  confident it was, and what is missing for the capabilities that are off. */
@Controller('api/diagnostics')
export class DiagnosticsController {
  constructor(private readonly platform: PlatformReporter) {}

  @Get()
  get(): AdapterReport {
    return this.platform.report();
  }
}
```

`apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics/diagnostics.controller';

@Module({ controllers: [DiagnosticsController] })
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

// Startup failures must be loud: a platform that boots half-configured hides the
// cause until someone opens the page that needed it.
bootstrap().catch((error: unknown) => {
  console.error('API failed to start:', error);
  process.exit(1);
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 26 tests.

- [ ] **Step 5: Start the API and check the endpoint**

Run: `pnpm --filter @wowcms/api dev`
Then: `curl http://localhost:3001/api/diagnostics`
Expected: a JSON body. Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): boot NestJS on Fastify with a diagnostics endpoint"
```

---

## Task 9: The accounts module

**Files:**
- Create: `modules/accounts/package.json`, `modules/accounts/src/accounts.service.ts`, `modules/accounts/src/adapter-gateway.ts`, `modules/accounts/src/accounts.controller.ts`, `modules/accounts/src/index.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/package.json`
- Test: `modules/accounts/src/accounts.service.test.ts`, `modules/accounts/src/accounts.controller.test.ts`

**Interfaces:**
- Consumes: `WowCmsModule` (Task 7), `createAccount`/`verifyPassword`/`FieldMap` (Tasks 4 and 6).
- Produces: `accountsModule: WowCmsModule`, `AccountsApiModule` (NestJS), `AccountsService.register(input)` / `AccountsService.login(username, password)` returning `{ accountId }`, and `AdapterAccountGateway` implementing `AccountGateway`. Routes land at `POST /api/m/accounts/register` and `POST /api/m/accounts/login`, which Task 10 calls.

- [ ] **Step 1: Write the failing test**

Create `modules/accounts/src/accounts.service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  AccountsService,
  InvalidCredentialsError,
  UsernameTakenError,
  type AccountGateway,
} from './accounts.service';

function makeService(overrides: Partial<AccountGateway> = {}) {
  const gateway: AccountGateway = {
    create: vi.fn(async () => 7),
    verify: vi.fn(async () => 7 as number | null),
    findByUsername: vi.fn(async () => null as number | null),
    ...overrides,
  };
  return { service: new AccountsService(gateway), gateway };
}

describe('AccountsService.register', () => {
  it('creates the account and returns its id', async () => {
    const { service } = makeService();
    await expect(service.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }))
      .resolves.toEqual({ accountId: 7 });
  });

  it('rejects a username that already exists', async () => {
    const { service } = makeService({ findByUsername: vi.fn(async () => 3) });
    await expect(service.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }))
      .rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('rejects a password shorter than 8 characters before touching the database', async () => {
    const { service, gateway } = makeService();
    await expect(service.register({ username: 'kev', password: 'short', email: 'a@b.c' }))
      .rejects.toThrow(/at least 8/);
    expect(gateway.create).not.toHaveBeenCalled();
  });
});

describe('AccountsService.login', () => {
  it('returns the account id for correct credentials', async () => {
    const { service } = makeService();
    await expect(service.login('kev', 'secret123')).resolves.toEqual({ accountId: 7 });
  });

  it('throws InvalidCredentialsError for a wrong password', async () => {
    const { service } = makeService({ verify: vi.fn(async () => null) });
    await expect(service.login('kev', 'nope')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run modules/accounts`
Expected: FAIL — cannot resolve `./accounts.service`.

- [ ] **Step 3: Implement the service and module**

`modules/accounts/package.json`:

```json
{
  "name": "@wowcms/module-accounts",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@wowcms/contracts": "workspace:*",
    "@wowcms/module-sdk": "workspace:*"
  }
}
```

`modules/accounts/src/accounts.service.ts`:

```ts
import type { AccountId, NewAccount } from '@wowcms/contracts';

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username '${username}' is already registered.`);
    this.name = 'UsernameTakenError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Username or password is incorrect.');
    this.name = 'InvalidCredentialsError';
  }
}

/** The account operations this module needs. The adapter supplies them, which is
 *  why nothing here knows how a password is hashed or which table it lands in. */
export interface AccountGateway {
  create(input: NewAccount): Promise<AccountId>;
  verify(username: string, password: string): Promise<AccountId | null>;
  findByUsername(username: string): Promise<AccountId | null>;
}

const MINIMUM_PASSWORD_LENGTH = 8;

export class AccountsService {
  constructor(private readonly accounts: AccountGateway) {}

  async register(input: NewAccount): Promise<{ accountId: AccountId }> {
    if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
    }

    if ((await this.accounts.findByUsername(input.username)) !== null) {
      throw new UsernameTakenError(input.username);
    }

    return { accountId: await this.accounts.create(input) };
  }

  async login(username: string, password: string): Promise<{ accountId: AccountId }> {
    const accountId = await this.accounts.verify(username, password);
    if (accountId === null) {
      throw new InvalidCredentialsError();
    }
    return { accountId };
  }
}
```

`modules/accounts/src/index.ts`:

```ts
import type { WowCmsModule } from '@wowcms/module-sdk';

export * from './accounts.service';

export const accountsModule: WowCmsModule = {
  id: 'accounts',
  version: '1.0.0',
  requires: { capabilities: ['accounts'] },
  permissions: [
    { key: 'accounts.manage', description: 'Create, lock and unlock game accounts' },
  ],
  dashboard: [
    { path: '/admin/accounts', title: 'Accounts', permission: 'accounts.manage' },
  ],
};
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 31 tests.

- [ ] **Step 5: Implement the gateway that binds the service to the adapter**

This is the only place where the module meets the emulator, and it goes through the
adapter functions rather than SQL of its own.

`modules/accounts/src/adapter-gateway.ts`:

```ts
import type { Pool } from 'mysql2/promise';
import type { AccountId, NewAccount } from '@wowcms/contracts';
import type { FieldMap } from '@wowcms/core-adapters';
import { createAccount, verifyPassword } from '@wowcms/core-adapters';
import type { AccountGateway } from './accounts.service';

export class AdapterAccountGateway implements AccountGateway {
  constructor(
    private readonly pool: Pool,
    private readonly map: FieldMap,
  ) {}

  create(input: NewAccount): Promise<AccountId> {
    return createAccount(this.pool, this.map, input);
  }

  verify(username: string, password: string): Promise<AccountId | null> {
    return verifyPassword(this.pool, this.map, username, password);
  }

  /** Reuses verifyPassword's lookup shape with an impossible password, so
   *  existence is answered without a second hand-written query. */
  async findByUsername(username: string): Promise<AccountId | null> {
    const table = this.map.accounts.table;
    const [rows] = await this.pool.execute(
      `SELECT \`${this.map.accounts.id}\` AS id FROM \`${table}\` ` +
        `WHERE \`${this.map.accounts.username}\` = ?`,
      [username.toUpperCase()],
    );
    const found = (rows as Array<{ id: number }>)[0];
    return found ? found.id : null;
  }
}
```

Add `"@wowcms/core-adapters": "workspace:*"` and `"mysql2": "^3.11.0"` to
`modules/accounts/package.json` dependencies.

- [ ] **Step 6: Write the failing controller test**

Create `modules/accounts/src/accounts.controller.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AccountsController } from './accounts.controller';
import { UsernameTakenError, InvalidCredentialsError } from './accounts.service';

describe('AccountsController', () => {
  it('returns the new account id on registration', async () => {
    const service = { register: vi.fn(async () => ({ accountId: 7 })), login: vi.fn() };
    const controller = new AccountsController(service as never);
    await expect(
      controller.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }),
    ).resolves.toEqual({ accountId: 7 });
  });

  it('maps a taken username to HTTP 409 rather than a 500', async () => {
    const service = {
      register: vi.fn(async () => { throw new UsernameTakenError('kev'); }),
      login: vi.fn(),
    };
    const controller = new AccountsController(service as never);
    await expect(
      controller.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('maps bad credentials to HTTP 401', async () => {
    const service = {
      register: vi.fn(),
      login: vi.fn(async () => { throw new InvalidCredentialsError(); }),
    };
    const controller = new AccountsController(service as never);
    await expect(controller.login({ username: 'kev', password: 'nope' }))
      .rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm vitest run modules/accounts`
Expected: FAIL — cannot resolve `./accounts.controller`.

- [ ] **Step 8: Implement the controller**

`modules/accounts/src/accounts.controller.ts`:

```ts
import { Body, ConflictException, Controller, Post, UnauthorizedException } from '@nestjs/common';
import type { AccountId, NewAccount } from '@wowcms/contracts';
import { AccountsService, InvalidCredentialsError, UsernameTakenError } from './accounts.service';

/** Mounted by the platform under /api/m/accounts. Its only job is turning domain
 *  errors into the right status codes; the rules live in the service. */
@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('register')
  async register(@Body() body: NewAccount): Promise<{ accountId: AccountId }> {
    try {
      return await this.accounts.register(body);
    } catch (error) {
      if (error instanceof UsernameTakenError) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }): Promise<{ accountId: AccountId }> {
    try {
      return await this.accounts.login(body.username, body.password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }
}
```

Add `"@nestjs/common": "^10.4.0"` to `modules/accounts/package.json` dependencies, and
attach the controller to the module declaration in `modules/accounts/src/index.ts`:

```ts
import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';

@Module({ controllers: [AccountsController] })
export class AccountsApiModule {}

export const accountsModule: WowCmsModule = {
  id: 'accounts',
  version: '1.0.0',
  requires: { capabilities: ['accounts'] },
  permissions: [
    { key: 'accounts.manage', description: 'Create, lock and unlock game accounts' },
  ],
  dashboard: [
    { path: '/admin/accounts', title: 'Accounts', permission: 'accounts.manage' },
  ],
  api: AccountsApiModule,
};
```

- [ ] **Step 9: Mount the module in the API**

Modify `apps/api/src/app.module.ts` so the route the web page calls exists:

```ts
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AccountsApiModule } from '@wowcms/module-accounts';
import { DiagnosticsController } from './diagnostics/diagnostics.controller';

@Module({
  imports: [
    AccountsApiModule,
    // Every module is namespaced by its id, so two modules can never collide.
    RouterModule.register([{ path: 'api/m/accounts', module: AccountsApiModule }]),
  ],
  controllers: [DiagnosticsController],
})
export class AppModule {}
```

Add `"@wowcms/module-accounts": "workspace:*"` to `apps/api/package.json` dependencies.

- [ ] **Step 10: Run the tests**

Run: `pnpm test`
Expected: PASS, 34 tests.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(accounts): add registration and login as the first module"
```

---

## Task 10: Web shell with registration

**Files:**
- Create: `apps/web/package.json`, `apps/web/astro.config.mjs`, `apps/web/src/lib/api.ts`, `apps/web/src/pages/register.astro`, `apps/web/src/pages/admin/diagnostics.astro`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: the API from Tasks 8-9.
- Produces: `apiFetch<T>(path, init)` used by every page, and two rendered routes.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './api';

describe('apiFetch', () => {
  it('returns the parsed body on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(apiFetch<{ ok: boolean }>('/api/diagnostics')).resolves.toEqual({ ok: true });
  });

  it('raises ApiError carrying the status and server message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Username taken' }), { status: 409 })));

    await expect(apiFetch('/api/m/accounts/register', { method: 'POST' }))
      .rejects.toMatchObject({ status: 409, message: 'Username taken' });
    await expect(apiFetch('/api/m/accounts/register', { method: 'POST' }))
      .rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web`
Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 3: Implement the client and pages**

`apps/web/package.json`:

```json
{
  "name": "@wowcms/web",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "astro dev", "build": "astro build" },
  "dependencies": {
    "@wowcms/contracts": "workspace:*",
    "astro": "^4.16.0"
  }
}
```

`apps/web/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Public pages stay static; only session-bound routes will opt into SSR, so the
  // site does not render a page per visitor for content that never changes.
  output: 'static',
});
```

`apps/web/src/lib/api.ts`:

```ts
const API_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** One door to the API, so error handling is written once rather than per page. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return body as T;
}
```

`apps/web/src/pages/register.astro`:

```astro
---
// Rendered statically; the form posts to the API from the browser, so the page
// itself needs no server render per visitor.
---
<html lang="en">
  <head><meta charset="utf-8" /><title>Create your game account</title></head>
  <body>
    <h1>Create your game account</h1>
    <form id="register">
      <label>Username <input name="username" required minlength="3" maxlength="32" /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Password <input name="password" type="password" required minlength="8" /></label>
      <button type="submit">Create account</button>
    </form>
    <p id="result" role="status"></p>

    <script>
      import { apiFetch } from '../lib/api';

      const form = document.querySelector<HTMLFormElement>('#register')!;
      const result = document.querySelector<HTMLElement>('#result')!;

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        try {
          await apiFetch('/api/m/accounts/register', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          result.textContent = 'Account created. You can now log in from the game client.';
        } catch (error) {
          result.textContent = error instanceof Error ? error.message : 'Something went wrong.';
        }
      });
    </script>
  </body>
</html>
```

`apps/web/src/pages/admin/diagnostics.astro`:

```astro
---
import type { AdapterReport } from '@wowcms/contracts';
import { apiFetch } from '../../lib/api';

// Fetched at build time for now; it becomes a session-guarded SSR route when the
// dashboard gains authentication.
let report: AdapterReport | null = null;
let error: string | null = null;

try {
  report = await apiFetch<AdapterReport>('/api/diagnostics');
} catch (cause) {
  error = cause instanceof Error ? cause.message : 'Unable to reach the API.';
}
---
<html lang="en">
  <head><meta charset="utf-8" /><title>Diagnostics</title></head>
  <body>
    <h1>Diagnostics</h1>
    {error && <p role="alert">{error}</p>}
    {report && (
      <dl>
        <dt>Adapter</dt><dd>{report.adapterId}</dd>
        <dt>Confidence</dt><dd>{report.score}</dd>
        <dt>Capabilities</dt><dd>{report.capabilities.join(', ')}</dd>
        <dt>Unavailable</dt><dd>{report.missing.join('; ') || 'nothing'}</dd>
      </dl>
    )}
  </body>
</html>
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS, 36 tests.

- [ ] **Step 5: Run both services and register end to end**

Run the API in one terminal: `pnpm --filter @wowcms/api dev`
Run the web in another: `pnpm --filter @wowcms/web dev`
Open `http://localhost:4321/register`, create an account, then log into the game client
with those credentials.

This is the moment Phase 1 is either done or not. A created account that the client
rejects means the password rule is wrong, and Task 5 is where to look.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add the registration page and diagnostics view"
```

---

## Out of scope for this plan

These have their own plans, one per module, once the contract has been proven by
the accounts module:

- JWT sessions and refresh tokens (needed by the launcher, not by registration)
- `content`, `armory`, `store`, `status` modules
- The CMS database, its migrations runner and the role editor
- Cache layer in front of emulator reads — introduce it with the first module that
  reads game data on a hot path, which is `status`
