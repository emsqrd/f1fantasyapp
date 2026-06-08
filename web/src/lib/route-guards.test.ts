import { requireAuth, requireNoTeam, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import { createAuthedAuth, createMockTeam } from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the TanStack Router redirect function
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    redirect: vi.fn((options) => {
      const error = new Error('Redirect') as Error & { redirect: typeof options };
      error.redirect = options;
      throw error;
    }),
  };
});

// Mock Supabase — requireAuth falls back to getSession() when context.auth.user
// is null to handle the lag between exchangeCodeForSession and React state.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

// Helper to create a mock user
const createMockUser = (): User => ({
  id: '123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
});

// Helper to create a mock session
const createMockSession = (): Session => ({
  access_token: 'mock-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token',
  user: createMockUser(),
});

// Guards don't read the client; it satisfies the RouterContext shape.
const queryClient = new QueryClient();

describe('route-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  });

  describe('requireAuth', () => {
    it('throws redirect when user is not authenticated', async () => {
      const context: RouterContext = {
        auth: {
          user: null,
          session: null,
          loading: false,
          isAuthTransitioning: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
          startAuthTransition: vi.fn(),
          completeAuthTransition: vi.fn(),
        },
        team: null,
        profile: null,
        currentSeason: null,
        queryClient,
      };

      await expect(() => requireAuth(context)).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/',
        replace: true,
      });
    });

    it('does not throw when user is authenticated', async () => {
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          isAuthTransitioning: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
          startAuthTransition: vi.fn(),
          completeAuthTransition: vi.fn(),
        },
        team: null,
        profile: null,
        currentSeason: null,
        queryClient,
      };

      await expect(requireAuth(context)).resolves.not.toThrow();
    });

    it('does not throw when context lags but Supabase has a session', async () => {
      // Simulates the moment right after the email-confirmation callback
      // signs the user in: Supabase has persisted the session (so
      // getSession() returns it), but AuthContext hasn't re-rendered yet,
      // so context.auth.user is still null. The guard should fall back to
      // getSession() and let the navigation through instead of redirecting.
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: createMockSession() },
        error: null,
      } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      const context: RouterContext = {
        auth: {
          user: null,
          session: null,
          loading: false,
          isAuthTransitioning: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
          startAuthTransition: vi.fn(),
          completeAuthTransition: vi.fn(),
        },
        team: null,
        profile: null,
        currentSeason: null,
        queryClient,
      };

      await expect(requireAuth(context)).resolves.not.toThrow();
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('requireTeam', () => {
    it('throws redirect to /create-team when there is no team in context', () => {
      const context: RouterContext = {
        auth: createAuthedAuth(),
        team: null,
        profile: null,
        currentSeason: null,
        queryClient,
      };

      expect(() => requireTeam(context)).toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/create-team',
        replace: true,
      });
    });

    it('returns the team when a team is present', () => {
      const team = createMockTeam();
      const context: RouterContext = {
        auth: createAuthedAuth(),
        team,
        profile: null,
        currentSeason: null,
        queryClient,
      };

      expect(requireTeam(context)).toEqual({ team });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('requireNoTeam', () => {
    it('throws redirect to / when a team is present in context', () => {
      const context: RouterContext = {
        auth: createAuthedAuth(),
        team: createMockTeam(),
        profile: null,
        currentSeason: null,
        queryClient,
      };

      expect(() => requireNoTeam(context)).toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/',
        replace: true,
      });
    });

    it('returns null when there is no team', () => {
      const context: RouterContext = {
        auth: createAuthedAuth(),
        team: null,
        profile: null,
        currentSeason: null,
        queryClient,
      };

      expect(requireNoTeam(context)).toEqual({ team: null });
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
