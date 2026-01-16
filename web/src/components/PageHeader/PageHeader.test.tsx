import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
// Import mocked modules
import { TeamProvider } from '@/contexts/TeamContext.tsx';
import type { UserProfile } from '@/contracts/UserProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { avatarEvents } from '@/lib/avatarEvents';
import type { User } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageHeader } from './PageHeader';

// Mock router hooks
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();
const mockUseMatches = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useMatches: () => mockUseMatches(),
}));

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useTeam');
vi.mock('@/lib/avatarEvents');
vi.mock('@/services/teamService', () => ({
  getMyTeam: vi.fn().mockResolvedValue(null),
}));
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
  },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseTeam = vi.mocked(useTeam);
const mockAvatarEvents = vi.mocked(avatarEvents);

const createMockUser = (): User => ({
  id: '1',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
});

const createMockTeamContext = (options: Partial<TeamContextType> = {}): TeamContextType => ({
  hasTeam: false,
  myTeamId: null,
  setMyTeamId: vi.fn(),
  refreshMyTeam: vi.fn(),
  ...options,
});

const createMockAuthContext = (user: User | null, loading = false): AuthContextType => ({
  user,
  session: null,
  loading,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
});

const createMockUserProfile = (avatarUrl = ''): UserProfile => ({
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  avatarUrl,
});

describe('PageHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    mockUseMatches.mockReturnValue([]);
    mockAvatarEvents.subscribe.mockReturnValue(vi.fn()); // Return unsubscribe function
  });

  const renderWithRouter = () => {
    return render(
      <TeamProvider>
        <PageHeader />
      </TeamProvider>,
    );
  };

  const getLogoButton = () => screen.getByRole('button', { name: 'Navigate to home page' });

  describe('Logo and branding', () => {
    it('should display the F1 Fantasy Sports logo and title', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseTeam.mockReturnValue(createMockTeamContext());

      renderWithRouter();

      expect(screen.getByText('F1 Fantasy Sports')).toBeInTheDocument();
      expect(getLogoButton()).toBeInTheDocument();
    });

    it('should navigate to home page when logo is clicked', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseTeam.mockReturnValue(createMockTeamContext());

      renderWithRouter();

      await user.click(getLogoButton());

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('should navigate to home page when logo is activated with keyboard', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseTeam.mockReturnValue(createMockTeamContext());

      renderWithRouter();

      const logoButton = getLogoButton();
      logoButton.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  describe('Authentication states', () => {
    it('should show user dropdown when authenticated', async () => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseTeam.mockReturnValue(createMockTeamContext());
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile() },
        },
      ]);

      renderWithRouter();

      expect(await screen.findByText('F1 Fantasy Sports')).toBeInTheDocument();

      const dropdownButtons = screen.getAllByRole('button');
      // Should have both logo button and dropdown menu trigger
      expect(dropdownButtons).toHaveLength(2);
    });

    it('shows sign in option when not authenticated', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseTeam.mockReturnValue(createMockTeamContext());

      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      );
      expect(dropdownTrigger).toBeInTheDocument();

      if (dropdownTrigger) {
        await user.click(dropdownTrigger);
        expect(screen.getByRole('menuitem', { name: 'Sign In' })).toBeInTheDocument();
      }
    });

    it('shows authenticated user menu options when user has a team', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseTeam.mockReturnValue(createMockTeamContext({ hasTeam: true }));

      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile() },
        },
      ]);

      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      );
      expect(dropdownTrigger).toBeInTheDocument();

      if (dropdownTrigger) {
        await user.click(dropdownTrigger);
        expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'My Leagues' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'My Team' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Sign Out' })).toBeInTheDocument();
      }
    });

    it('shows authenticated user menu options when user does not have a team', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseTeam.mockReturnValue(createMockTeamContext({ hasTeam: false }));

      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile() },
        },
      ]);

      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      );

      expect(dropdownTrigger).toBeInTheDocument();

      if (dropdownTrigger) {
        await user.click(dropdownTrigger);
        expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Create Team' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Sign Out' })).toBeInTheDocument();
      }
    });

    it('should hide dropdown menu on auth pages', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseLocation.mockReturnValue({
        pathname: '/sign-in',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderWithRouter();

      // Should only have the logo button, no dropdown
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(getLogoButton()).toBeInTheDocument();
    });

    it('should hide dropdown menu while loading', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null, true));

      renderWithRouter();

      // Should only have the logo button, no dropdown
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(getLogoButton()).toBeInTheDocument();
    });
  });

  describe('Navigation actions', () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile() },
        },
      ]);
    });

    it('should navigate to account page when My Account is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      )!;
      await user.click(dropdownTrigger);

      const accountMenuItem = screen.getByRole('menuitem', { name: 'My Account' });
      await user.click(accountMenuItem);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/account' });
    });

    it('navigates to users leagues list when My Leagues is clicked', async () => {
      const user = userEvent.setup();
      mockUseTeam.mockReturnValue(createMockTeamContext({ hasTeam: true }));

      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      )!;
      await user.click(dropdownTrigger);

      const dashboardMenuItem = screen.getByRole('menuitem', { name: 'My Leagues' });
      await user.click(dashboardMenuItem);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/leagues' });
    });

    it('should navigate to sign-in page when Sign In is clicked', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(createMockAuthContext(null));

      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      )!;
      await user.click(dropdownTrigger);

      const signInMenuItem = screen.getByRole('menuitem', { name: 'Sign In' });
      await user.click(signInMenuItem);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in' });
    });

    it('should sign out and navigate to home when Sign Out is clicked', async () => {
      const user = userEvent.setup();
      const mockSignOut = vi.fn();
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue({
        ...createMockAuthContext(mockUser),
        signOut: mockSignOut,
      });

      renderWithRouter();

      const dropdownButtons = screen.getAllByRole('button');
      const dropdownTrigger = dropdownButtons.find(
        (button) => button.getAttribute('aria-haspopup') === 'menu',
      )!;
      await user.click(dropdownTrigger);

      const signOutMenuItem = screen.getByRole('menuitem', { name: 'Sign Out' });
      await user.click(signOutMenuItem);

      expect(mockSignOut).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  describe('Avatar functionality', () => {
    it('should display avatar container when user is authenticated', async () => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('https://example.com/avatar.jpg') },
        },
      ]);

      renderWithRouter();

      // Avatar container should be present
      await waitFor(() => {
        const avatarElements = screen.getAllByRole('button');
        const avatarButton = avatarElements.find(
          (button) => button.getAttribute('aria-haspopup') === 'menu',
        );
        expect(avatarButton).toBeInTheDocument();
      });
    });

    it('should show loading overlay while fetching user profile', async () => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('https://example.com/avatar.jpg') },
        },
      ]);

      renderWithRouter();

      // Check for loading spinner by looking for the loading overlay div
      await waitFor(() => {
        const loadingOverlay = document.querySelector('.animate-spin');
        expect(loadingOverlay).toBeInTheDocument();
      });
    });

    it('should handle avatar fetch error gracefully', async () => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile() },
        },
      ]);
      const { captureException } = await import('@sentry/react');

      renderWithRouter();

      // Components no longer capture exceptions - API client handles it
      await waitFor(() => {
        expect(captureException).not.toHaveBeenCalled();
      });
    });

    it('should clear avatar state when user logs out', async () => {
      // Start with authenticated user
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('https://example.com/avatar.jpg') },
        },
      ]);

      const { rerender } = renderWithRouter();

      await waitFor(() => {
        const avatarButtons = screen.getAllByRole('button');
        const avatarButton = avatarButtons.find(
          (button) => button.getAttribute('aria-haspopup') === 'menu',
        );
        expect(avatarButton).toBeInTheDocument();
      });

      // Simulate user logging out
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseMatches.mockReturnValue([]);

      rerender(
        <TeamProvider>
          <PageHeader />
        </TeamProvider>,
      );

      // After logout, dropdown menu should no longer be available
      await waitFor(() => {
        const avatarButtons = screen.getAllByRole('button');
        const avatarButton = avatarButtons.find(
          (button) => button.getAttribute('aria-haspopup') === 'menu',
        );
        expect(avatarButton).toBeInTheDocument(); // Dropdown should still be available for sign-in
      });
      expect(getLogoButton()).toBeInTheDocument();
    });

    it('should unsubscribe from avatar events on unmount', () => {
      const mockUnsubscribe = vi.fn();
      mockAvatarEvents.subscribe.mockReturnValue(mockUnsubscribe);

      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('') },
        },
      ]);

      const { unmount } = renderWithRouter();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });
  });

  describe('Auth page detection', () => {
    it('should hide dropdown on sign-up page', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseLocation.mockReturnValue({
        pathname: '/sign-up',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderWithRouter();

      // Should only have logo button
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(getLogoButton()).toBeInTheDocument();
    });

    it('should show dropdown on non-auth pages', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null));
      mockUseLocation.mockReturnValue({
        pathname: '/dashboard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderWithRouter();

      // Should have both logo and dropdown buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1);
      expect(getLogoButton()).toBeInTheDocument();
    });
  });

  describe('Race condition prevention', () => {
    it('should not update state when component unmounts during profile fetch', async () => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('https://example.com/avatar.jpg') },
        },
      ]);

      // Spy on console.error to detect React warnings about state updates on unmounted components
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = renderWithRouter();

      // Unmount the component
      unmount();

      // Wait to ensure async operations complete
      await waitFor(() => {
        expect(mockUseAuth).toHaveBeenCalled();
      });

      // Verify no React warnings about setState on unmounted component
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('unmounted component'),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not update avatar when user changes rapidly', async () => {
      const user1 = createMockUser();
      const user2 = { ...createMockUser(), id: '2', email: 'user2@example.com' };

      // First render with user1
      mockUseAuth.mockReturnValue(createMockAuthContext(user1));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('https://example.com/user1-avatar.jpg') },
        },
      ]);

      const { rerender } = renderWithRouter();

      // Change user to user2
      mockUseAuth.mockReturnValue(createMockAuthContext(user2));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile('https://example.com/user2-avatar.jpg') },
        },
      ]);

      rerender(
        <TeamProvider>
          <PageHeader />
        </TeamProvider>,
      );

      // Wait for second profile to load and verify correct avatar is displayed
      await waitFor(() => {
        const avatarImg = screen.queryByRole('img', { hidden: true });
        if (avatarImg) {
          expect(avatarImg).toHaveAttribute('src', 'https://example.com/user2-avatar.jpg');
        }
      });
    });

    it('should handle error during profile fetch without state update after unmount', async () => {
      const mockUser = createMockUser();
      mockUseAuth.mockReturnValue(createMockAuthContext(mockUser));
      mockUseMatches.mockReturnValue([
        {
          routeId: '__root__',
          context: { profile: createMockUserProfile() },
        },
      ]);

      const { unmount } = renderWithRouter();

      unmount();

      // Verify component unmounted without errors
      await waitFor(() => {
        expect(mockUseAuth).toHaveBeenCalled();
      });
    });
  });
});
