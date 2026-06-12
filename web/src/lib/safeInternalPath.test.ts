import { describe, expect, it } from 'vitest';

import { safeInternalPath } from './safeInternalPath';

describe('safeInternalPath', () => {
  it.each([
    ['a plain path', '/my-team', '/my-team'],
    ['a path with query and fragment', '/league/5?tab=x#y', '/league/5?tab=x#y'],
  ])('keeps %s', (_label, input, expected) => {
    expect(safeInternalPath(input)).toBe(expected);
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['backslash-folded', '/\\evil.com'],
    ['absolute external', 'https://evil.com'],
    ['javascript: scheme', 'javascript:alert(1)'],
  ])('rejects %s', (_label, input) => {
    expect(safeInternalPath(input)).toBeUndefined();
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
  ])('returns undefined for %s', (_label, input) => {
    expect(safeInternalPath(input)).toBeUndefined();
  });
});
