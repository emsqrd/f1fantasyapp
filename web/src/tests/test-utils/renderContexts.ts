import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
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
 * Test utility: Creates a `TeamContextType` value for `renderWithRouter`.
 *
 * Defaults to no team. Pass `{ myTeamId: 1, hasTeam: true }` for team-required flows.
 */
export function createTeamContext(overrides: Partial<TeamContextType> = {}): TeamContextType {
  return {
    myTeamId: null,
    hasTeam: false,
    setMyTeamId: vi.fn(),
    refreshMyTeam: vi.fn(),
    ...overrides,
  };
}

/**
 * Test utility: Creates the `routerContext` arg for `renderWithRouter`
 * (`Omit<RouterContext, 'auth'>` — auth is wired separately via the `auth` field).
 *
 * Defaults nest a fresh `createTeamContext()`. Override `teamContext` directly
 * when the same value also needs to flow through a `TeamContext.Provider` in
 * the route-tree root.
 */
export function createBaseRouterContext(
  overrides: Partial<Omit<RouterContext, 'auth'>> = {},
): Omit<RouterContext, 'auth'> {
  return {
    teamContext: createTeamContext(),
    team: null,
    profile: null,
    currentSeason: null,
    ...overrides,
  };
}
