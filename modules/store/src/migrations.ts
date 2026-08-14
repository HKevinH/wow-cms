import type { Migration } from "@wowcms/module-sdk";

export const storeMigrations: readonly Migration[] = [
  {
    version: 1,
    name: "store-catalog",
    statements: [
      `CREATE TABLE IF NOT EXISTS store_config (setting_key VARCHAR(64) NOT NULL, setting_value VARCHAR(255) NOT NULL, PRIMARY KEY (setting_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS store_payment_method (id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(120) NOT NULL, description VARCHAR(500) NOT NULL DEFAULT '', checkout_url VARCHAR(500) NOT NULL DEFAULT '', enabled TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS store_package (id INT UNSIGNED NOT NULL AUTO_INCREMENT, payment_method_id INT UNSIGNED NULL, name VARCHAR(120) NOT NULL, description VARCHAR(500) NOT NULL DEFAULT '', amount DECIMAL(12,2) NOT NULL DEFAULT 0, currency VARCHAR(8) NOT NULL DEFAULT 'USD', donor_points INT UNSIGNED NOT NULL DEFAULT 0, vote_points INT UNSIGNED NOT NULL DEFAULT 0, enabled TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, PRIMARY KEY (id), KEY idx_package_method (payment_method_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS store_item (id INT UNSIGNED NOT NULL AUTO_INCREMENT, realm_id INT UNSIGNED NULL, item_id INT UNSIGNED NOT NULL, name VARCHAR(160) NOT NULL, description TEXT NOT NULL, icon_url VARCHAR(500) NOT NULL DEFAULT '', category VARCHAR(80) NOT NULL DEFAULT '', price_donor_points INT UNSIGNED NOT NULL DEFAULT 0, price_vote_points INT UNSIGNED NOT NULL DEFAULT 0, details_json JSON NULL, enabled TINYINT(1) NOT NULL DEFAULT 1, PRIMARY KEY (id), KEY idx_store_item_enabled (enabled)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ],
  },
  {
    version: 2,
    name: "store-item-display",
    statements: [
      // Zero means "no display known". Items published before this migration
      // keep it and fall back to their 2D icon, which is also what an item
      // whose art the pipeline cannot reach ends up doing.
      `ALTER TABLE store_item ADD COLUMN display_id INT UNSIGNED NOT NULL DEFAULT 0`,
      `ALTER TABLE store_item ADD COLUMN inventory_type TINYINT UNSIGNED NOT NULL DEFAULT 0`,
    ],
  },
];
