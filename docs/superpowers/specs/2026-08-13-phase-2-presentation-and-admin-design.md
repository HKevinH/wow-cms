# Phase 2 — Presentation layer, CMS database and administration

**Status:** approved
**Date:** 2026-08-13
**Follows:** `2026-08-13-wow-cms-design.md`

## What this adds

Phase 1 left a platform that can register an account against TrinityCore 5.4.8 and
report which adapter it chose. It has no content of its own, no database of its
own, and a public site that is three pages of placeholder.

Phase 2 delivers the part a visitor and an administrator actually touch:

- **2A — Presentation.** A Mists of Pandaria theme, a configurable media pipeline,
  a video masthead, and the public pages, in Spanish and English.
- **2B — Persistence.** The CMS's own database, a per-module migration runner, and
  sessions built on the game account.
- **2C — Administration.** A dashboard where news, media, settings and accounts are
  edited, replacing 2A's sample data.

The order matters: 2A fixes the shape of the content, 2B persists that shape, 2C
edits it. Designing the schema before the site exists would mean inventing columns
for pages nobody has seen.

## Decisions that cross all three

**Astro runs in `hybrid` mode.** Public pages stay prerendered — they are the same
for every visitor and should be served as files. `/admin/*` and the session routes
opt out with `export const prerender = false`. A single mode cannot serve both: fully
static has no server to hold a session, fully server-rendered re-renders a news list
that changed last Tuesday.

**Administrators log in with their game account.** The 5.4.8 adapter already computes
the emulator's password hash, and `verifyPassword` already exists, so a site login is
a lookup rather than a second credential. Roles and permissions live in the CMS
database, keyed by the emulator's account id. A separate table of CMS users would mean
two passwords per person and a synchronisation problem, and buys nothing.

**Artwork is fetched, not committed.** `apps/web/media.manifest.json` lists every
external asset the configured theme wants; `pnpm media:fetch` downloads them into
`apps/web/public/media/remote/`, which is ignored by git. The manifest is versioned,
so any clone can reproduce the set with one command, and the distributable repository
carries no artwork that belongs to someone else. A deployment that owns its artwork
drops files into `public/media/` and points `SiteConfig` at them instead.

## 2A — Presentation

### Theme

`pandaria` joins `blizzard` and `minimal` as a third stylesheet under
`[data-site-theme]`, defining the same variable contract. Its palette comes from the
expansion: jade for the primary action, imperial gold for anything that costs money,
a near-black ground with a green cast. No component changes to support it — that is
the test of whether the theme contract is real.

### SiteConfig

`apps/web/src/config/site.ts` is the one place a page learns the realm's name, its
locales, its media paths and its external links. Components read from it and never
name a URL. In 2C the same shape is filled from the settings API instead of the file,
so the components do not change again.

### i18n

`src/i18n/` holds a flat dictionary per locale (`es`, `en`) and a `t()` that resolves
at build time. Spanish is the default and is served from `/`; English is served from
`/en/`. No i18n library: the resolver is a lookup with a typed key union, which is
about thirty lines and gives a compile error for a missing string — more than a
runtime library would.

### Components

| Component | Responsibility |
|---|---|
| `HeroVideo` | Looping muted video masthead, poster fallback, static image under `prefers-reduced-motion`, overlaid logo and calls to action |
| `FeatureIcons` | The row of circular icons under the masthead |
| `FeaturePanel` | Alternating image/text block on a panel texture |
| `Faq` | `<details>` accordion, no script |
| `SiteHeader` | Brand, navigation, locale switch, mobile menu |
| `SiteFooter` | Footer with its own artwork and the non-affiliation notice |

### Pages

`/`, `/noticias`, `/noticias/[slug]`, `/como-conectar`, `/estado`, `/registro`,
`/entrar`, each mirrored under `/en/`. Every page renders data typed against
`@wowcms/contracts`, filled from sample data until 2B is wired.

## 2B — Persistence

### `@wowcms/platform-db`

A package holding the CMS's own pool and a migration runner. Migrations are declared
by modules (`WowCmsModule.migrations`), namespaced by module id, and applied in order
inside a transaction, with what has run recorded in `wowcms_migration`. The runner is
the platform's, not each module's, so two modules cannot invent two conventions.

The CMS database is separate from the emulator's. The emulator's schema belongs to
the emulator; adding tables to it is how a CMS becomes impossible to upgrade.

### Modules

- **`content`** — news posts: slug, locale, title, excerpt, body, category, published
  timestamp, draft flag.
- **`media`** — the media library: uploaded files plus registered remote URLs, with
  the metadata the admin needs to pick one.
- **`settings`** — namespaced key/value settings, typed per module through the
  existing `SettingsSchema` idea, backing `SiteConfig`.

### Sessions and permissions

Login verifies the username and password through the adapter, then issues an opaque
session token stored in `wowcms_session` and set as an `HttpOnly`, `SameSite=Lax`
cookie. Roles live in `wowcms_role`, grants in `wowcms_account_role`, and each module
declares its permission keys as it already may. A guard resolves the session to a
permission set once per request.

The first account to log in when no roles exist is granted `owner`. Otherwise a fresh
install has an administration area nobody can enter.

## 2C — Administration

`DashboardLayout` takes its navigation from the enabled modules' `dashboard`
declarations rather than a hardcoded list, which is what makes an installed module
appear in the sidebar without editing the shell.

Screens: overview, news list and editor, media library, site settings, accounts, and
the existing diagnostics page. Each is gated by the permission its module declares.

## Testing

Vitest covers what has logic: the i18n resolver, the migration runner's ordering and
idempotency, the content and settings services against a fake repository, the session
store's expiry, and the permission resolver. The media manifest is checked against
`SiteConfig` so a referenced asset that nobody declared fails the suite rather than
404ing in a browser. Appearance is reviewed in a browser; snapshot tests of markup
would only assert that the markup is what it is.

## Out of scope

Store and donations, armory, and the launcher. Comments on news. A rich text editor —
the news body is Markdown, rendered at read time.
