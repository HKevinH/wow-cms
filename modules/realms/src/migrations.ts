import type { Migration } from '@wowcms/module-sdk';

export const realmsMigrations: readonly Migration[] = [{
  version: 1,
  name: 'realms',
  statements: [`CREATE TABLE IF NOT EXISTS realm (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(96) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    expansion VARCHAR(96) NOT NULL DEFAULT '',
    realmlist VARCHAR(255) NOT NULL DEFAULT '',
    auth_database_url VARCHAR(1000) NOT NULL,
    characters_database_url VARCHAR(1000) NOT NULL,
    world_database_url VARCHAR(1000) NOT NULL,
    soap_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    soap_port INT UNSIGNED NOT NULL DEFAULT 7878,
    auth_port INT UNSIGNED NOT NULL DEFAULT 3724,
    world_port INT UNSIGNED NOT NULL DEFAULT 8085,
    store_url VARCHAR(500) NOT NULL DEFAULT '',
    theme VARCHAR(64) NOT NULL DEFAULT 'pandaria',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_realm_slug (slug),
    KEY idx_realm_enabled (enabled, name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`],
}, {
  version: 2,
  name: 'unique-realm-ports',
  statements: [
    'ALTER TABLE realm ADD UNIQUE KEY uq_realm_soap_port (soap_port)',
    'ALTER TABLE realm ADD UNIQUE KEY uq_realm_auth_port (auth_port)',
    'ALTER TABLE realm ADD UNIQUE KEY uq_realm_world_port (world_port)',
  ],
}];
