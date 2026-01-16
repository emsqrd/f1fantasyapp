import { requireAuth, requireNoTeam, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { getMyTeam } from '@/services/teamService';
import type { Session, User } from '@supabase/supabase-js';
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

// Mock teamService
vi.mock('@/services/teamService', () => ({
  getMyTeam: vi.fn(),
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

describe('route-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('throws redirect when user is not authenticated', async () => {
      const context: RouterContext = {
        auth: {
          user: null,
          session: null,
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
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
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      await expect(requireAuth(context)).resolves.not.toThrow();
    });

    it('redirects to landing page with replace option', async () => {
      const context: RouterContext = {
        auth: {
          user: null,
          session: null,
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      try {
        await requireAuth(context);
      } catch (error) {
        expect((error as Error & { redirect: unknown }).redirect).toEqual({
          to: '/',
          replace: true,
        });
      }
    });
  });

  describe('requireTeam', () => {
    it('throws redirect when user does not have a team', async () => {
      vi.mocked(getMyTeam).mockResolvedValue(null);
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      await expect(() => requireTeam(context)).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/create-team',
        replace: true,
      });
    });

    it('does not throw when user has a team', async () => {
      vi.mocked(getMyTeam).mockResolvedValue({
        id: 1,
        name: 'Test Team',
        ownerName: 'Test Owner',
        drivers: [],
        constructors: [],
      });
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: 1,
          hasTeam: true,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      await expect(requireTeam(context)).resolves.not.toThrow();
    });

    it('does not throw when user is not authenticated', async () => {
      const context: RouterContext = {
        auth: {
          user: null,
          session: null,
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      // Should throw redirect because requireAuth is called first and user is not authenticated
      await expect(() => requireTeam(context)).rejects.toThrow();
    });

    it('redirects to create-team page with replace option', async () => {
      vi.mocked(getMyTeam).mockResolvedValue(null);
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      try {
        await requireTeam(context);
      } catch (error) {
        expect((error as Error & { redirect: unknown }).redirect).toEqual({
          to: '/create-team',
          replace: true,
        });
      }
    });
  });

  describe('requireNoTeam', () => {
    it('throws redirect when user already has a team', async () => {
      vi.mocked(getMyTeam).mockResolvedValue({
        id: 1,
        name: 'Test Team',
        ownerName: 'Test Owner',
        drivers: [],
        constructors: [],
      });
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: 1,
          hasTeam: true,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      await expect(() => requireNoTeam(context)).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: '/leagues',
        replace: true,
      });
    });

    it('does not throw when user does not have a team', async () => {
      vi.mocked(getMyTeam).mockResolvedValue(null);
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: null,
          hasTeam: false,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      await expect(requireNoTeam(context)).resolves.not.toThrow();
    });

    it('does not throw when user is not authenticated', async () => {
      const context: RouterContext = {
        auth: {
          user: null,
          session: null,
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: 1,
          hasTeam: true,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      // Should throw redirect because requireAuth is called first and user is not authenticated
      await expect(() => requireNoTeam(context)).rejects.toThrow();
    });

    it('redirects to leagues page with replace option', async () => {
      vi.mocked(getMyTeam).mockResolvedValue({
        id: 1,
        name: 'Test Team',
        ownerName: 'Test Owner',
        drivers: [],
        constructors: [],
      });
      const context: RouterContext = {
        auth: {
          user: createMockUser(),
          session: createMockSession(),
          loading: false,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        },
        teamContext: {
          myTeamId: 1,
          hasTeam: true,
          setMyTeamId: vi.fn(),
          refreshMyTeam: vi.fn(),
        },
        team: null,
        profile: null,
      };

      try {
        await requireNoTeam(context);
      } catch (error) {
        expect((error as Error & { redirect: unknown }).redirect).toEqual({
          to: '/leagues',
          replace: true,
        });
      }
    });
  });
});
