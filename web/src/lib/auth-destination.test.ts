import { describe, expect, it } from 'vitest';

import { getPostSignupDestination } from './auth-destination';

describe('getPostSignupDestination', () => {
  it('returns the redirect param when provided', () => {
    expect(getPostSignupDestination('/leagues')).toBe('/leagues');
  });

  it('returns the redirect param for nested paths', () => {
    expect(getPostSignupDestination('/leagues/123')).toBe('/leagues/123');
  });

  it('falls back to /create-team when redirect is undefined', () => {
    expect(getPostSignupDestination(undefined)).toBe('/create-team');
  });

  it('falls back to /create-team when redirect is omitted', () => {
    expect(getPostSignupDestination()).toBe('/create-team');
  });

  it('falls back to /create-team when redirect is an empty string', () => {
    expect(getPostSignupDestination('')).toBe('/create-team');
  });
});
