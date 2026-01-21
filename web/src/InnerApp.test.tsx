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

const createMockAuthContext = (
  user: { id: string } | null,
  loading = false,
  isAuthTransitioning = false
): AuthContextType => ({
  user: user as AuthContextType['user'],
  session: null,
  loading,
  isAuthTransitioning,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  startAuthTransition: vi.fn(),
  completeAuthTransition: vi.fn(),
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

  describe('Initial Loading State', () => {
    it('displays loading message when auth is loading', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, true));

      const { getByText } = render(<InnerApp />);

      expect(getByText('Loading...')).toBeInTheDocument();
    });

    it('announces loading state to screen readers', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, true));

      const { getByRole } = render(<InnerApp />);

      expect(getByRole('status')).toBeInTheDocument();
    });

    it('does not render router when auth is loading', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, true));

      const { queryByTestId } = render(<InnerApp />);

      expect(queryByTestId('router-provider')).not.toBeInTheDocument();
    });

    it('renders router when auth finishes loading', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, true));

      const { getByTestId, queryByText, rerender } = render(<InnerApp />);

      // Initially loading - no router
      expect(queryByText('Loading...')).toBeInTheDocument();

      // Auth finishes loading
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false));
      rerender(<InnerApp />);

      // Router should now be rendered, loading message should be gone
      expect(getByTestId('router-provider')).toBeInTheDocument();
      expect(queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('shows loading for null user during initial auth check', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null, true));

      const { getByText, queryByTestId } = render(<InnerApp />);

      expect(getByText('Loading...')).toBeInTheDocument();
      expect(queryByTestId('router-provider')).not.toBeInTheDocument();
    });
  });

  describe('Auth Transitioning Overlay', () => {
    it('displays overlay loader when auth is transitioning', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, true));

      const { getAllByText, getByTestId } = render(<InnerApp />);

      // Router should be rendered
      expect(getByTestId('router-provider')).toBeInTheDocument();

      // Overlay loader should also be visible
      const loadingTexts = getAllByText('Loading...');
      expect(loadingTexts.length).toBeGreaterThan(0);
    });

    it('renders router alongside auth transitioning overlay', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, true));

      const { getByTestId, getAllByRole } = render(<InnerApp />);

      // Both router and overlay should be present
      expect(getByTestId('router-provider')).toBeInTheDocument();
      expect(getAllByRole('status').length).toBeGreaterThan(0);
    });

    it('hides overlay when auth transition completes', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, true));

      const { queryAllByRole, rerender } = render(<InnerApp />);

      // Overlay should be present
      expect(queryAllByRole('status').length).toBeGreaterThan(0);

      // Transition completes
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, false));
      rerender(<InnerApp />);

      // Overlay should be gone
      expect(queryAllByRole('status').length).toBe(0);
    });

    it('shows overlay during sign out transition', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, false));

      const { rerender, queryByRole } = render(<InnerApp />);

      // No overlay initially
      expect(queryByRole('status')).not.toBeInTheDocument();

      // Start sign out transition
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, true));
      rerender(<InnerApp />);

      // Overlay should appear
      expect(queryByRole('status')).toBeInTheDocument();
    });

    it('shows overlay during sign in transition', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null, false, false));

      const { rerender, queryByRole } = render(<InnerApp />);

      // No overlay initially
      expect(queryByRole('status')).not.toBeInTheDocument();

      // Start sign in transition
      mockUseAuth.mockReturnValue(createMockAuthContext(null, false, true));
      rerender(<InnerApp />);

      // Overlay should appear
      expect(queryByRole('status')).toBeInTheDocument();
    });
  });

  describe('Combined Loading States', () => {
    it('shows only initial loader when both loading and transitioning', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, true, true));

      const { queryByTestId, getAllByRole } = render(<InnerApp />);

      // Should show initial loader, not router or overlay
      expect(queryByTestId('router-provider')).not.toBeInTheDocument();
      expect(getAllByRole('status').length).toBe(1);
    });

    it('transitions from initial loading to auth transitioning', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, true, false));

      const { getByTestId, getAllByRole, rerender } = render(<InnerApp />);

      // Initial loading state
      expect(getAllByRole('status').length).toBe(1);

      // Auth finishes loading but starts transitioning
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, true));
      rerender(<InnerApp />);

      // Should now show router with overlay
      expect(getByTestId('router-provider')).toBeInTheDocument();
      expect(getAllByRole('status').length).toBeGreaterThan(0);
    });

    it('handles rapid state changes during authentication flow', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null, true, false));

      const { getByTestId, queryByRole, rerender } = render(<InnerApp />);

      // Initial loading
      expect(queryByRole('status')).toBeInTheDocument();

      // Loading finishes
      mockUseAuth.mockReturnValue(createMockAuthContext(null, false, false));
      rerender(<InnerApp />);
      expect(getByTestId('router-provider')).toBeInTheDocument();

      // User starts sign in
      mockUseAuth.mockReturnValue(createMockAuthContext(null, false, true));
      rerender(<InnerApp />);
      expect(queryByRole('status')).toBeInTheDocument();

      // Sign in completes
      mockUseAuth.mockReturnValue(createMockAuthContext({ id: 'user-a' }, false, false));
      rerender(<InnerApp />);
      expect(queryByRole('status')).not.toBeInTheDocument();
      expect(getByTestId('router-provider')).toBeInTheDocument();
    });
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
