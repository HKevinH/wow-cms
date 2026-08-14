import { describe, expect, it } from 'vitest';
import { WILDCARD_PERMISSION, hasPermission, type Viewer } from '../auth';

const viewer = (permissions: string[]): Viewer => ({
  accountId: 1,
  username: 'CHEN',
  roles: ['editor'],
  permissions,
});

describe('hasPermission', () => {
  it('denies everything to a viewer that is not there', () => {
    expect(hasPermission(null, 'admin.access')).toBe(false);
  });

  it('grants exactly what was listed', () => {
    const editor = viewer(['content.write']);
    expect(hasPermission(editor, 'content.write')).toBe(true);
    expect(hasPermission(editor, 'settings.manage')).toBe(false);
  });

  it('lets the wildcard cover a permission from a module installed later', () => {
    // This is the whole reason the owner role holds '*' rather than an expanded
    // list: installing a module must not leave the owner locked out of it.
    expect(hasPermission(viewer([WILDCARD_PERMISSION]), 'armory.moderate')).toBe(true);
  });

  it('does not treat a prefix as a match', () => {
    expect(hasPermission(viewer(['content.write']), 'content')).toBe(false);
    expect(hasPermission(viewer(['content']), 'content.write')).toBe(false);
  });
});
