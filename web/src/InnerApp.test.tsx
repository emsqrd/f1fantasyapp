import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InnerApp } from './InnerApp';
import type { AuthContextType } from './contexts/AuthContext';
import type { TeamContextType } from './contexts/TeamContext';
// Import after mocks are set up
import { useAuth } from './hooks/useAuth';
import { useTeam } from './hooks/useTeam';
import { router } from './router';

// Mock dependencies
vi.mock('./hooks/useAuth');
vi.mock('./hooks/useTeam');
vi.mock('./router', () => ({
  router: {
    invalidate: vi.fn(),
  },
}));
vi.mock('@tanstack/react-router', () => ({
  RouterProvider: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="router-provider">{children}</div>
  ),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseTeam = vi.mocked(useTeam);
const mockRouterInvalidate = vi.mocked(router.invalidate);

const createMockAuthContext = (user: { id: string } | null, loading = false): AuthContextType => ({
  user: user as AuthContextType['user'],
  session: null,
  loading,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
});

const createMockTeamContext = (): TeamContextType => ({
  hasTeam: false,
  myTeamId: null,
  setMyTeamId: vi.fn(),
  refreshMyTeam: vi.fn(),
});

describe('InnerApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeam.mockReturnValue(createMockTeamContext());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('router cache invalidation', () => {
    it('does not invalidate on initial render', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }));

      render(<InnerApp />);

      expect(mockRouterInvalidate).not.toHaveBeenCalled();
    });

    it('invalidates when user signs out', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }));

      const { rerender } = render(<InnerApp />);

      // Simulate sign out
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      rerender(<InnerApp />);

      await waitFor(() => {
        expect(mockRouterInvalidate).toHaveBeenCalledOnce();
      });
    });

    it('invalidates when switching between users', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }));

      const { rerender } = render(<InnerApp />);

      // User A signs out, User B signs in
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-b' }));
      rerender(<InnerApp />);

      await waitFor(() => {
        expect(mockRouterInvalidate).toHaveBeenCalledOnce();
      });
    });
  });
});
