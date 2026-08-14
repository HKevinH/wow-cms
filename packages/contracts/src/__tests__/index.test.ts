import { describe, expect, it } from 'vitest';
import { ADAPTER_CAPABILITIES, CONTRACTS_VERSION } from '../index';

describe('contracts package', () => {
  it('exposes a version the API and clients can compare against', () => {
    // Pinned to a shape rather than a literal: asserting the current number only
    // means editing two places whenever it changes, which teaches nobody
    // anything. What matters is that it stays parseable as semver.
    expect(CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('names every capability exactly once', () => {
    expect(new Set(ADAPTER_CAPABILITIES).size).toBe(ADAPTER_CAPABILITIES.length);
  });
});
