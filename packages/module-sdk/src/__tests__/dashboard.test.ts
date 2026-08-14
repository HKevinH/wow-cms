import { describe, expect, it } from 'vitest';
import { WILDCARD_PERMISSION, type Viewer } from '@wowcms/contracts';
import { declaredPermissions, resolveDashboard } from '../dashboard';
import type { WowCmsModule } from '../module';

const content: WowCmsModule = {
  id: 'content',
  version: '1.0.0',
  permissions: [{ key: 'content.write', description: 'Write news' }],
  dashboard: [
    { path: '/admin/news', title: 'News', permission: 'content.write', order: 20 },
  ],
};

const store: WowCmsModule = {
  id: 'store',
  version: '1.0.0',
  permissions: [{ key: 'store.manage', description: 'Manage the store' }],
  dashboard: [{ path: '/admin/store', title: 'Store', permission: 'store.manage', order: 10 }],
};

const viewer = (permissions: string[]): Viewer => ({
  accountId: 1,
  username: 'CHEN',
  roles: [],
  permissions,
});

describe('resolveDashboard', () => {
  it('shows only what the viewer may open', () => {
    const sections = resolveDashboard([content, store], viewer(['content.write']));
    expect(sections.map((s) => s.path)).toEqual(['/admin/news']);
  });

  it('shows nothing to a viewer who is not logged in', () => {
    expect(resolveDashboard([content, store], null)).toEqual([]);
  });

  it('sorts by the declared order, not by registration', () => {
    const sections = resolveDashboard([content, store], viewer([WILDCARD_PERMISSION]));
    expect(sections.map((s) => s.title)).toEqual(['Store', 'News']);
  });

  it('attaches the module a section came from', () => {
    const [section] = resolveDashboard([content], viewer([WILDCARD_PERMISSION]));
    expect(section?.moduleId).toBe('content');
  });

  it('leaves out a module that contributes no dashboard', () => {
    const headless: WowCmsModule = { id: 'status', version: '1.0.0' };
    expect(resolveDashboard([headless], viewer([WILDCARD_PERMISSION]))).toEqual([]);
  });
});

describe('declaredPermissions', () => {
  it('collects every key the installed modules define, plus the core ones', () => {
    expect(declaredPermissions([content, store], ['admin.access'])).toEqual([
      'admin.access',
      'content.write',
      'store.manage',
    ]);
  });

  it('does not repeat a key two modules both declare', () => {
    const other: WowCmsModule = {
      id: 'other',
      version: '1.0.0',
      permissions: [{ key: 'content.write', description: 'Also writes news' }],
    };
    expect(declaredPermissions([content, other])).toEqual(['content.write']);
  });
});
