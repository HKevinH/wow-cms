import type { Migration } from '@wowcms/module-sdk';

/** Identity lives in the CMS database, keyed by the emulator's account id.
 *
 *  Nothing here duplicates the emulator: no username, no password material, no
 *  email. An account is a number this database has opinions about, and the
 *  emulator remains the only thing that can say whether a password is right. The
 *  session row carries the username only so a viewer can be built without a
 *  second query on every request. */
export const authMigrations: readonly Migration[] = [
  {
    version: 1,
    name: 'roles-grants-and-sessions',
    statements: [
      `CREATE TABLE IF NOT EXISTS wowcms_role (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name        VARCHAR(64)  NOT NULL,
        description VARCHAR(255) NOT NULL DEFAULT '',
        permissions TEXT         NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_role_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS wowcms_account_role (
        account_id INT UNSIGNED NOT NULL,
        role_id    INT UNSIGNED NOT NULL,
        granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (account_id, role_id),
        KEY idx_account_role_role (role_id),
        CONSTRAINT fk_account_role_role FOREIGN KEY (role_id)
          REFERENCES wowcms_role (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // The token itself is never stored. A dump of this table hands an attacker
      // hashes, not live sessions.
      `CREATE TABLE IF NOT EXISTS wowcms_session (
        token_hash CHAR(64)     NOT NULL,
        account_id INT UNSIGNED NOT NULL,
        username   VARCHAR(64)  NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME     NOT NULL,
        PRIMARY KEY (token_hash),
        KEY idx_session_account (account_id),
        KEY idx_session_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ],
  },
];
