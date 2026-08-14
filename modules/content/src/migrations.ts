import type { Migration } from '@wowcms/module-sdk';

export const contentMigrations: readonly Migration[] = [
  {
    version: 1,
    name: 'news-posts',
    statements: [
      /* Every table this module owns is prefixed with its id, which is what makes
         two modules unable to collide and uninstalling one comprehensible.

         (slug, locale) is unique rather than slug alone: the Spanish and English
         versions of an announcement are separate posts that may legitimately want
         the same slug, and forcing them apart would put a language marker in a URL
         that already has one in its prefix. */
      `CREATE TABLE IF NOT EXISTS content_post (
        id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug         VARCHAR(96)  NOT NULL,
        locale       VARCHAR(8)   NOT NULL,
        title        VARCHAR(200) NOT NULL,
        excerpt      VARCHAR(500) NOT NULL DEFAULT '',
        category     VARCHAR(64)  NOT NULL DEFAULT '',
        body         MEDIUMTEXT   NOT NULL,
        cover_url    VARCHAR(500)     NULL,
        published    TINYINT(1)   NOT NULL DEFAULT 0,
        published_at DATETIME         NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_post_slug_locale (slug, locale),
        KEY idx_post_listing (locale, published, published_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ],
  },
];
