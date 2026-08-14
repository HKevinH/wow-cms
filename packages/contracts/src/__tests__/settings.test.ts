import { describe, expect, it } from 'vitest';
import { SITE_SETTINGS_SCHEMA, applySchema, type SettingRecord } from '../settings';

const record = (namespace: string, key: string, value: string): SettingRecord => ({
  namespace,
  key,
  value,
  updatedAt: '2026-08-13T00:00:00.000Z',
});

describe('applySchema', () => {
  it('returns the defaults when nothing has been stored', () => {
    // A fresh install has no rows at all, so this is the normal path.
    const values = applySchema(SITE_SETTINGS_SCHEMA, []);
    expect(values.theme).toBe('pandaria');
    expect(Object.keys(values).sort()).toEqual(
      SITE_SETTINGS_SCHEMA.fields.map((f) => f.key).sort(),
    );
  });

  it('prefers a stored value over the default', () => {
    const values = applySchema(SITE_SETTINGS_SCHEMA, [record('site', 'theme', 'minimal')]);
    expect(values.theme).toBe('minimal');
  });

  it('ignores rows belonging to another module', () => {
    const values = applySchema(SITE_SETTINGS_SCHEMA, [record('store', 'theme', 'stolen')]);
    expect(values.theme).toBe('pandaria');
  });

  it('drops stored keys the schema no longer declares', () => {
    // Otherwise a setting removed in an upgrade keeps being handed to code that
    // stopped expecting it.
    const values = applySchema(SITE_SETTINGS_SCHEMA, [record('site', 'removedSetting', 'x')]);
    expect(values.removedSetting).toBeUndefined();
  });
});
