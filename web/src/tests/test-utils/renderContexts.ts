import type { AuthContextType } from '@/contexts/AuthContext';
import type { RouterContext } from '@/lib/router-context';
import type { Session, User } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Test utility: Creates an unauthenticated `AuthContextType` for `renderWithRouter`.
 *
 * Each call returns a fresh object with new `vi.fn()` instances so tests don't
 * inherit mock state across files.
 */
export function createUnauthAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    session: null,
    loading: false,
    isAuthTransitioning: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    startAuthTransition: vi.fn(),
    completeAuthTransition: vi.fn(),
    ...overrides,
  };
}

/**
 * Test utility: Creates an authenticated `AuthContextType` for `renderWithRouter`.
 *
 * Defaults to `user: { id: 'user-123' }`. Pass `{ user: { id: '...' } as User }`
 * when a test keys off a specific user id (e.g. league-owner scenarios).
 */
export function createAuthedAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    ...createUnauthAuth(),
    user: { id: 'user-123' } as User,
    session: {} as Session,
    ...overrides,
  };
}

/**
 * Test utility: Creates the `routerContext` arg for `renderWithRouter`
 * (`Omit<RouterContext, 'auth' | 'queryClient'>` — auth and the per-test
 * queryClient are wired separately by `renderWithRouter`).
 */
export function createBaseRouterContext(
  overrides: Partial<Omit<RouterContext, 'auth' | 'queryClient'>> = {},
): Omit<RouterContext, 'auth' | 'queryClient'> {
  return {
    team: null,
    ...overrides,
  };
}
