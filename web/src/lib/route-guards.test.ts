import { redirectIfAuthenticated, requireAuth, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { teamQueries } from '@/services/teamService';
import { createAuthedAuth, createMockTeam } from '@/tests/test-utils';
import type { User } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { type RedirectOptions, redirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the TanStack Router redirect function
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    redirect: vi.fn((options: RedirectOptions) => {
      const error = new Error('Redirect') as Error & { redirect: typeof options };
      error.redirect = options;
      throw error;
    }),
  };
});

// Helper to create a mock user
const createMockUser = (): User => ({
  id: '123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
});

// Guards don't read the client; it satisfies the RouterContext shape.
const queryClient = new QueryClient();

describe('route-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('throws redirect to /sign-in carrying the attempted destination when unauthenticated', () => {
      const context: RouterContext = {
        auth: { user: null },
        queryClient,
      };

      expect(() => requireAuth(context, '/my-team')).toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { redirect: '/my-team' },
        replace: true,
      });
    });

    it('throws redirect to /sign-in with no destination when redirectTo is omitted', () => {
      const context: RouterContext = {
        auth: { user: null },
        queryClient,
      };

      expect(() => requireAuth(context)).toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { redirect: undefined },
        replace: true,
      });
    });

    it('does not throw when user is authenticated', () => {
      const context: RouterContext = {
        auth: { user: createMockUser() },
        queryClient,
      };

      expect(() => requireAuth(context)).not.toThrow();
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('redirectIfAuthenticated', () => {
    it('throws redirect to the destination when authenticated with a redirect', () => {
      const context: RouterContext = {
        auth: { user: createMockUser() },
        queryClient,
      };

      expect(() => redirectIfAuthenticated(context, '/league/5')).toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/league/5',
        replace: true,
      });
    });

    it('throws redirect to / when authenticated without a redirect', () => {
      const context: RouterContext = {
        auth: { user: createMockUser() },
        queryClient,
      };

      expect(() => redirectIfAuthenticated(context)).toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/',
        replace: true,
      });
    });

    it('does not throw when user is unauthenticated', () => {
      const context: RouterContext = {
        auth: { user: null },
        queryClient,
      };

      expect(() => redirectIfAuthenticated(context)).not.toThrow();
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('requireTeam', () => {
    it('throws redirect to /create-team when the team query resolves to null', async () => {
      const teamlessClient = new QueryClient();
      teamlessClient.setQueryData(teamQueries.mine().queryKey, null);
      const context: RouterContext = {
        auth: createAuthedAuth(),
        queryClient: teamlessClient,
      };

      await expect(() => requireTeam(context)).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/create-team',
        replace: true,
      });
    });

    it('resolves without redirecting when the team query has a team', async () => {
      const teamClient = new QueryClient();
      teamClient.setQueryData(teamQueries.mine().queryKey, createMockTeam());
      const context: RouterContext = {
        auth: createAuthedAuth(),
        queryClient: teamClient,
      };

      await expect(requireTeam(context)).resolves.toBeUndefined();
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
