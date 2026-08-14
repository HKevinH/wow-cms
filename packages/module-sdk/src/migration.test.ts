import { describe, expect, it } from 'vitest';
import { assertValidHistory, type Migration } from './migration';

const migration = (version: number, name = `step-${version}`): Migration => ({
  version,
  name,
  statements: ['CREATE TABLE content_post (id INT)'],
});

describe('assertValidHistory', () => {
  it('accepts an ascending history', () => {
    expect(() => assertValidHistory('content', [migration(1), migration(2)])).not.toThrow();
  });

  it('accepts a module with no migrations at all', () => {
    expect(() => assertValidHistory('status', [])).not.toThrow();
  });

  it('rejects a repeated version', () => {
    // Two branches both adding 'migration 3' is the usual way this happens, and
    // it has to fail at startup rather than apply one and skip the other.
    expect(() => assertValidHistory('content', [migration(1), migration(1)])).toThrow(/not after/);
  });

  it('rejects a version that goes backwards', () => {
    expect(() => assertValidHistory('content', [migration(2), migration(1)])).toThrow(/not after/);
  });

  it('rejects a version below one', () => {
    expect(() => assertValidHistory('content', [migration(0)])).toThrow(/start at 1/);
  });

  it('rejects a migration that would apply nothing', () => {
    expect(() =>
      assertValidHistory('content', [{ version: 1, name: 'empty', statements: [] }]),
    ).toThrow(/no statements/);
  });

  it('names the module in the message, since the runner sees them all', () => {
    expect(() => assertValidHistory('armory', [migration(0)])).toThrow(/armory/);
  });
});
