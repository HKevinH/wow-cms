import { describe, expect, it } from 'vitest';
import { mergeManifest, parseManifest, serialiseManifest } from '../manifest';

describe('mergeManifest', () => {
  it('adds newly converted displays to what was there before', () => {
    const merged = mergeManifest({ '1685': '1685.glb' }, { '3092': '3092.glb' });
    expect(merged.models).toEqual({ '1685': '1685.glb', '3092': '3092.glb' });
  });

  it('lets a rebuild replace where a display points', () => {
    // Re-running after a texture fix has to move the display onto the new
    // file rather than leave it on the stale one.
    const merged = mergeManifest({ '1685': 'old.glb' }, { '1685': 'new.glb' });
    expect(merged.models['1685']).toBe('new.glb');
  });

  it('lets several displays share one file', () => {
    // Displays that share both mesh and texture are the same model twice;
    // there are 10,957 such pairs behind 23,975 displays.
    const merged = mergeManifest({}, { '1621': '1621.glb', '2380': '1621.glb' });
    expect(merged.models['1621']).toBe('1621.glb');
    expect(merged.models['2380']).toBe('1621.glb');
  });

  it('orders entries numerically so a rebuild diffs cleanly', () => {
    const merged = mergeManifest({}, { '10000': 'a.glb', '999': 'b.glb', '1685': 'c.glb' });
    expect(Object.keys(merged.models)).toEqual(['999', '1685', '10000']);
  });
});

describe('parseManifest', () => {
  it('reads back what it wrote', () => {
    const round = parseManifest(serialiseManifest(mergeManifest({}, { '1685': '1685.glb' })));
    expect(round.models).toEqual({ '1685': '1685.glb' });
  });

  it('treats a missing file as an empty catalogue', () => {
    // The site has to render before the tool has ever run.
    expect(parseManifest(undefined).models).toEqual({});
  });

  it('treats unreadable contents as empty rather than throwing', () => {
    expect(parseManifest('{ not json').models).toEqual({});
  });

  it('drops entries whose file name is not a string', () => {
    expect(parseManifest('{"models":{"1685":"a.glb","3092":null}}').models).toEqual({
      '1685': 'a.glb',
    });
  });
});
