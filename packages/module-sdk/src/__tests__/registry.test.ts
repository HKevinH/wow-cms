import { describe, expect, it } from 'vitest';
import { resolveModules } from '../registry';
import type { WowCmsModule } from '../module';

const accounts: WowCmsModule = { id: 'accounts', version: '1.0.0' };
const armory: WowCmsModule = {
  id: 'armory',
  version: '1.0.0',
  requires: { capabilities: ['characters'] },
};
const guilds: WowCmsModule = {
  id: 'guilds',
  version: '1.0.0',
  requires: { capabilities: ['guilds'] },
};
const store: WowCmsModule = {
  id: 'store',
  version: '1.0.0',
  requires: { modules: ['accounts'] },
};
const orphan: WowCmsModule = {
  id: 'orphan',
  version: '1.0.0',
  requires: { modules: ['missing'] },
};

describe('resolveModules', () => {
  it('enables a module whose capabilities are available', () => {
    const result = resolveModules([armory], ['accounts', 'characters']);
    expect(result.enabled.map((m) => m.id)).toEqual(['armory']);
  });

  it('disables a module whose capability is missing, naming it', () => {
    const result = resolveModules([guilds], ['accounts', 'characters']);
    expect(result.enabled).toHaveLength(0);
    expect(result.disabled[0]?.reason).toContain('guilds');
  });

  it('enables a module whose required module is present', () => {
    const result = resolveModules([accounts, store], ['accounts']);
    expect(result.enabled.map((m) => m.id)).toEqual(['accounts', 'store']);
  });

  it('disables a module whose required module is absent, naming it', () => {
    const result = resolveModules([orphan], ['accounts']);
    expect(result.disabled[0]?.reason).toContain('missing');
  });

  it('rejects two modules claiming the same id', () => {
    expect(() => resolveModules([accounts, accounts], ['accounts'])).toThrow(/duplicate/i);
  });
});
