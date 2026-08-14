# WoW CMS

A CMS for World of Warcraft private servers, built as a module platform rather
than a fixed set of features. The armory, the store and everything else are
plugins written against a public contract; the platform is the product.

Version 1 targets TrinityCore 5.4.8. Other cores are a structural promise: the
seams are designed in, one adapter is implemented.

## Requirements

- Node >= 20 and pnpm >= 10
- A reachable MySQL holding a TrinityCore auth database

## Running it

```bash
pnpm install
cp .env.example .env      # defaults already point at a local 5.4.8 server
pnpm dev                  # starts the API and the website together
```

- Website: http://localhost:4321
- API: http://localhost:3001
- Diagnostics: http://localhost:4321/admin/diagnostics

`pnpm dev` runs every package that declares a `dev` script, in parallel. To run
one on its own use `pnpm dev:api` or `pnpm dev:web`.

## Tests

```bash
pnpm test
```

Integration tests need a live database and read `WOWCMS_TEST_AUTH_URL`. When it
is unset they skip rather than fail, so the suite stays green on a machine
without a server:

```bash
WOWCMS_TEST_AUTH_URL="mysql://root:root@127.0.0.1:3306/auth" pnpm test
```

## How it fits together

| Path | What lives there |
|---|---|
| `apps/api` | NestJS on Fastify. All business logic. |
| `apps/web` | Astro. Public site and dashboard. |
| `packages/contracts` | Types shared by the API, the web app and future clients. |
| `packages/module-sdk` | The public module contract. |
| `packages/core-adapters` | One adapter per emulator family. |
| `modules/*` | Features, each written against the SDK. |
| `tools/*` | Offline tooling. Nothing running depends on it. |

Two rules hold the design up:

**No SQL contains an emulator table or column name.** The platform reads
`INFORMATION_SCHEMA` at startup, adapters score how well they recognise it, and
queries build their identifiers from a field map that configuration can
override. A patched schema needs a config edit, not a fork.

**No module reaches the emulator directly.** Modules receive an adapter. That is
what makes support for another core a new package rather than an audit of every
module.

## Item models

Store items can be shown as the 3D model the game uses. The art is converted
ahead of time by `tools/model-pipeline`, which reads the client's archives and
writes `.glb` files into `apps/web/public/models`. The site serves those as
static files: no game data reaches production, and an item without a model —
including every piece of body armour, which has none to begin with — keeps
showing its 2D icon. See that package's README for how to run it.

## Themes

A theme is a set of CSS custom properties and nothing else; Tailwind reads those
variables rather than holding a palette. Swapping themes never touches a
component. Two ship: `blizzard` (default) and `minimal`. Set `PUBLIC_THEME` to
choose. Light and dark within a theme are a reader preference, remembered in the
browser.
