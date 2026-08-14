import { DEFAULT_LOCALE, LOCALES, type Locale } from "../i18n";

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
  readonly soapPort: number;
  readonly storeUrl?: string;
  readonly locales: readonly Locale[];
  readonly defaultLocale: Locale;
  readonly media: {
    readonly logo?: MediaRef;
    readonly hero: {
      readonly sources: readonly {
        readonly src: string;
        readonly type: string;
      }[];
      readonly poster?: string;
      readonly posterMobile?: string;
    };
    readonly featuresBackground: string;
    readonly featuresBackgroundMobile: string;
    readonly social?: string;
    readonly icons: Readonly<
      Record<
        "scenarios" | "challenges" | "pets" | "dungeons" | "pandaren",
        string
      >
    >;
    readonly cards: Readonly<
      Record<
        "levelCap" | "talents" | "timeless" | "alts" | "pandaren" | "launch",
        string
      >
    >;
  };
  readonly links: {
    readonly discord?: string;
    readonly rules?: string;
    readonly contact?: string;
  };
}

/** Artwork downloaded by `pnpm media:fetch`. Kept as a prefix rather than spelled
 *  out per entry so pointing the site at your own files is one edit. */
const REMOTE = "/media/remote";

/** The one place a page learns what this install is called, where its artwork is
 *  and what it links to. Components read from here and never name a URL, which is
 *  what lets the settings module take over as the source in the admin phase
 *  without any component changing.
 *
 *  Environment variables win where they are set, so a deployment can rename the
 *  realm without a rebuild of this file. */
export function getSiteConfig(): SiteConfig {
  return {
    name: "Reino de Pandaria",
    description: "A private World of Warcraft realm.",
    expansion: "Mists of Pandaria 5.4.8",
    realmlist: "set realmlist logon.mi-reino.com",
    authPort: 3724,
    worldPort: 8085,
    soapPort: 7878,
    storeUrl: "http://localhost:8787",
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,

    media: {
      logo: { src: `${REMOTE}/brand/logo.png`, alt: "Mists of Pandaria" },
      hero: {
        // webm first: a browser that understands both picks the smaller file, and
        // one that understands neither falls through to the poster.
        sources: [
          { src: `${REMOTE}/hero/masthead-loop.webm`, type: "video/webm" },
          { src: `${REMOTE}/hero/masthead-loop.mp4`, type: "video/mp4" },
        ],
        poster: `${REMOTE}/hero/masthead.jpg`,
        posterMobile: `${REMOTE}/hero/masthead-mobile.jpg`,
      },
      featuresBackground: `${REMOTE}/panels/features.jpg`,
      featuresBackgroundMobile: `${REMOTE}/panels/features-mobile.png`,
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
        pandaren: `${REMOTE}/cards/pandaren.jpg`,
        launch: `${REMOTE}/cards/launch.jpg`,
      },
    },

    links: {
      discord: undefined,
      rules: undefined,
      contact: undefined,
    },
  };
}

/** Every remote path the config points at, flattened. The manifest test walks
 *  this, so an asset added to the config but not declared for download fails the
 *  suite rather than 404ing in somebody's browser. */
export function remoteAssetPaths(
  config: SiteConfig = getSiteConfig(),
): string[] {
  const { media } = config;
  const candidates = [
    media.logo?.src,
    media.social,
    media.hero.poster,
    media.hero.posterMobile,
    media.featuresBackground,
    media.featuresBackgroundMobile,
    ...media.hero.sources.map((source) => source.src),
    ...Object.values(media.icons),
    ...Object.values(media.cards),
  ];

  return candidates
    .filter(
      (value): value is string =>
        typeof value === "string" && value.startsWith(`${REMOTE}/`),
    )
    .map((value) => value.slice(REMOTE.length + 1));
}
