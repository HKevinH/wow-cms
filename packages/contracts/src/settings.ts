/** Settings are namespaced by the module that owns them and stored as strings,
 *  because the store has to hold settings for modules it has never heard of. The
 *  owning module supplies the schema that turns those strings back into typed
 *  values, so the platform never has to know what 'store.currency' means. */
export interface SettingRecord {
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export const SETTING_TYPES = ['string', 'number', 'boolean', 'url', 'media'] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

export interface SettingDefinition {
  readonly key: string;
  readonly label: string;
  readonly type: SettingType;
  readonly description?: string;
  readonly defaultValue: string;
}

export interface SettingsSchema {
  readonly namespace: string;
  readonly title: string;
  readonly fields: readonly SettingDefinition[];
}

/** The settings the site chrome reads. This is the shape `SiteConfig` is built
 *  from once the settings module is the source, which is why it lives in
 *  contracts rather than in the web app. */
export interface SiteSettings {
  readonly siteName: string;
  readonly serverDescription: string;
  readonly expansion: string;
  readonly theme: string;
  readonly realmlist: string;
  readonly authPort: string;
  readonly worldPort: string;
  readonly soapPort: string;
  readonly storeUrl: string;
  readonly logoUrl: string;
  readonly heroVideoUrl: string;
  readonly heroPosterUrl: string;
  readonly discordUrl: string;
  readonly rulesUrl: string;
  readonly contactUrl: string;
}

export const SITE_SETTINGS_SCHEMA: SettingsSchema = {
  namespace: 'site',
  title: 'Site',
  fields: [
    { key: 'siteName', label: 'Site name', type: 'string', defaultValue: 'Reino de Pandaria' },
    { key: 'serverDescription', label: 'Server description', type: 'string', defaultValue: 'A private World of Warcraft realm.' },
    { key: 'expansion', label: 'Expansion', type: 'string', defaultValue: 'Mists of Pandaria 5.4.8' },
    {
      key: 'theme',
      label: 'Theme',
      type: 'string',
      description: 'pandaria, blizzard or minimal.',
      defaultValue: 'pandaria',
    },
    { key: 'authPort', label: 'Authserver port', type: 'number', defaultValue: '3724' },
    { key: 'worldPort', label: 'Worldserver port', type: 'number', defaultValue: '8085' },
    { key: 'soapPort', label: 'SOAP port', type: 'number', description: 'Worldserver SOAP port for administrative commands.', defaultValue: '7878' },
    { key: 'storeUrl', label: 'Store URL', type: 'url', defaultValue: 'http://localhost:8787' },
    {
      key: 'realmlist',
      label: 'Realmlist line',
      type: 'string',
      description: 'Exactly what a player pastes into Config.wtf.',
      defaultValue: 'set realmlist logon.mi-reino.com',
    },
    { key: 'logoUrl', label: 'Logo', type: 'media', defaultValue: '' },
    { key: 'heroVideoUrl', label: 'Hero video', type: 'media', defaultValue: '' },
    { key: 'heroPosterUrl', label: 'Hero poster', type: 'media', defaultValue: '' },
    { key: 'discordUrl', label: 'Discord invite', type: 'url', defaultValue: '' },
    { key: 'rulesUrl', label: 'Rules link', type: 'url', defaultValue: '' },
    { key: 'contactUrl', label: 'Contact link', type: 'url', defaultValue: '' },
  ],
};

/** Turns stored rows into a typed object, filling anything absent from the
 *  schema's defaults. A fresh install has no rows at all, so this path is the
 *  normal one rather than the exception. */
export function applySchema(
  schema: SettingsSchema,
  records: readonly SettingRecord[],
): Record<string, string> {
  const stored = new Map(
    records.filter((r) => r.namespace === schema.namespace).map((r) => [r.key, r.value]),
  );

  return Object.fromEntries(
    schema.fields.map((field) => [field.key, stored.get(field.key) ?? field.defaultValue]),
  );
}
