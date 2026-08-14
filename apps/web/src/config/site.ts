import { DEFAULT_LOCALE, LOCALES, type Locale } from '../i18n';

/** Where a piece of artwork lives. Components take one of these rather than a
 *  string so a missing asset is expressible: `undefined` means "the theme's
 *  gradient will do", and every component that takes artwork has to handle it. */
export interface MediaRef {
  readonly src: string;
  /** Empty for decorative artwork, which is most of it. */
  readonly alt?: string;
}

export interface SiteConfig {
  readonly name: string;
  readonly description: string;
  readonly expansion: string;
  readonly realmlist: string;
  readonly authPort: number;
  readonly worldPort: number;
  readonly storeUrl?: string;
  readonly locales: readonly Locale[];
  readonly defaultLocale: Locale;
  readonly media: {
    readonly logo?: MediaRef;
    readonly hero: {
      readonly sources: readonly { readonly src: string; readonly type: string }[];
      readonly poster?: string;
      readonly posterMobile?: string;
    };
    readonly social?: string;
    readonly icons: Readonly<Record<'scenarios' | 'challenges' | 'pets' | 'dungeons' | 'pandaren', string>>;
    readonly cards: Readonly<Record<'levelCap' | 'talents' | 'timeless' | 'alts', string>>;
  };
  readonly links: {
    readonly discord?: string;
    readonly rules?: string;
    readonly contact?: string;
  };
}

/** Artwork downloaded by `pnpm media:fetch`. Kept as a prefix rather than spelled
 *  out per entry so pointing the site at your own files is one edit. */
const REMOTE = '/media/remote';

/** The one place a page learns what this install is called, where its artwork is
 *  and what it links to. Components read from here and never name a URL, which is
 *  what lets the settings module take over as the source in the admin phase
 *  without any component changing.
 *
 *  Environment variables win where they are set, so a deployment can rename the
 *  realm without a rebuild of this file. */
export function getSiteConfig(): SiteConfig {
  const env = import.meta.env;

  return {
    name: env.PUBLIC_SITE_NAME ?? 'Reino de Pandaria',
    description: env.PUBLIC_SERVER_DESCRIPTION ?? 'A private World of Warcraft realm.',
    expansion: env.PUBLIC_EXPANSION ?? 'Mists of Pandaria 5.4.8',
    realmlist: env.PUBLIC_REALMLIST ?? 'set realmlist logon.mi-reino.com',
    authPort: Number(env.PUBLIC_AUTH_PORT ?? 3724),
    worldPort: Number(env.PUBLIC_WORLD_PORT ?? 8085),
    storeUrl: env.PUBLIC_STORE_URL,
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,

    media: {
      logo: { src: `${REMOTE}/brand/logo.png`, alt: 'Mists of Pandaria' },
      hero: {
        // webm first: a browser that understands both picks the smaller file, and
        // one that understands neither falls through to the poster.
        sources: [
          { src: `${REMOTE}/hero/masthead-loop.webm`, type: 'video/webm' },
          { src: `${REMOTE}/hero/masthead-loop.mp4`, type: 'video/mp4' },
        ],
        poster: `${REMOTE}/hero/masthead.jpg`,
        posterMobile: `${REMOTE}/hero/masthead-mobile.jpg`,
      },
      social: `${REMOTE}/social/og.jpg`,
      icons: {
        scenarios: `${REMOTE}/icons/scenarios.jpg`,
        challenges: `${REMOTE}/icons/challenges.jpg`,
        pets: `${REMOTE}/icons/pets.jpg`,
        dungeons: `${REMOTE}/icons/dungeons.jpg`,
        pandaren: `${REMOTE}/icons/pandaren.jpg`,
      },
      cards: {
        levelCap: `${REMOTE}/cards/level-cap.jpg`,
        talents: `${REMOTE}/cards/dungeons-and-raids.jpg`,
        timeless: `${REMOTE}/cards/celestial-difficulty.jpg`,
        alts: `${REMOTE}/cards/alt-friendly.jpg`,
      },
    },

    links: {
      discord: env.PUBLIC_DISCORD_URL,
      rules: env.PUBLIC_RULES_URL,
      contact: env.PUBLIC_CONTACT_URL,
    },
  };
}

/** Every remote path the config points at, flattened. The manifest test walks
 *  this, so an asset added to the config but not declared for download fails the
 *  suite rather than 404ing in somebody's browser. */
export function remoteAssetPaths(config: SiteConfig = getSiteConfig()): string[] {
  const { media } = config;
  const candidates = [
    media.logo?.src,
    media.social,
    media.hero.poster,
    media.hero.posterMobile,
    ...media.hero.sources.map((source) => source.src),
    ...Object.values(media.icons),
    ...Object.values(media.cards),
  ];

  return candidates
    .filter((value): value is string => typeof value === 'string' && value.startsWith(`${REMOTE}/`))
    .map((value) => value.slice(REMOTE.length + 1));
}
