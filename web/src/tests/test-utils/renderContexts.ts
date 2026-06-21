import type { Auth } from '@/lib/authStore';
import type { Session, User } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Test utility: Creates an unauthenticated `Auth` value for `renderWithRouter`.
 *
 * Each call returns a fresh object with new `vi.fn()` instances so tests don't
 * inherit mock state across files.
 */
export function createUnauthAuth(overrides: Partial<Auth> = {}): Auth {
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
 * Test utility: Creates an authenticated `Auth` value for `renderWithRouter`.
 *
 * Defaults to `user: { id: 'user-123' }`. Pass `{ user: { id: '...' } as User }`
 * when a test keys off a specific user id (e.g. league-owner scenarios).
 */
export function createAuthedAuth(overrides: Partial<Auth> = {}): Auth {
  return {
    ...createUnauthAuth(),
    user: { id: 'user-123' } as User,
    session: {} as Session,
    ...overrides,
  };
}
