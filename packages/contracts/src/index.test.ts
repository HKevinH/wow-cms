import { describe, expect, it } from 'vitest';
import { ADAPTER_CAPABILITIES, CONTRACTS_VERSION } from './index';

describe('contracts package', () => {
  it('exposes a version the API and clients can compare against', () => {
    expect(CONTRACTS_VERSION).toBe('1.0.0');
  });
});

describe('adapter capabilities', () => {
  it('lists the capabilities a module may require', () => {
    expect(ADAPTER_CAPABILITIES).toContain('accounts');
    expect(ADAPTER_CAPABILITIES).toContain('characters');
    expect(ADAPTER_CAPABILITIES).toContain('guilds');
  });
});
