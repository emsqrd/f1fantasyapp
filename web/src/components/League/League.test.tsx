import type { League as LeagueType } from '@/contracts/League';
import type { LeagueInvite } from '@/contracts/LeagueInvite';
import { createMockLeague } from '@/test-utils/mockFactories';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { League } from './League';

// Mock the Leaderboard component since League is primarily a layout/container component
vi.mock('../Leaderboard/Leaderboard', () => ({
  Leaderboard: () => <div data-testid="leaderboard">Mocked Leaderboard</div>,
}));

// Mock TanStack Router hooks
const mockUseLoaderData = vi.fn();
const mockUseRouteContext = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: (opts: { from: string }) => mockUseLoaderData(opts),
  useRouteContext: (opts: { from: string }) => mockUseRouteContext(opts),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock league invite service
const mockGetOrCreateLeagueInvite = vi.fn();
vi.mock('@/services/leagueInviteService', () => ({
  getOrCreateLeagueInvite: (leagueId: number) => mockGetOrCreateLeagueInvite(leagueId),
}));

// Mock useClipboard hook
const mockCopy = vi.fn();
const mockReset = vi.fn();
const mockUseClipboard = vi.fn();

vi.mock('@/hooks/useClipboard', () => ({
  useClipboard: () => mockUseClipboard(),
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const leagueMock: LeagueType = createMockLeague();
const mockLeagueInvite: LeagueInvite = {
  id: 1,
  leagueId: leagueMock.id,
  token: 'abc123xyz',
  shareableUrl: `${window.location.origin}/join/abc123xyz`,
};

describe('League', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: mock loader data with league
    mockUseLoaderData.mockReturnValue({
      league: leagueMock,
    });

    // Default: mock route context with profile (as owner)
    mockUseRouteContext.mockReturnValue({
      profile: {
        id: leagueMock.ownerId,
        email: 'owner@example.com',
        username: 'LeagueOwner',
      },
    });

    // Default: mock useClipboard hook
    mockUseClipboard.mockReturnValue({
      copy: mockCopy,
      reset: mockReset,
      hasCopied: false,
      copiedValue: null,
    });

    // Default: mock successful invite fetch
    mockGetOrCreateLeagueInvite.mockResolvedValue(mockLeagueInvite);
  });

  it('displays league information from loader data', () => {
    render(<League />);

    // League name should be displayed immediately (no loading state)
    expect(screen.getByRole('heading', { level: 2, name: 'League 1' })).toBeInTheDocument();

    // User should see the main content: the leaderboard
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
  });

  it('has accessible heading structure for screen readers', () => {
    render(<League />);

    // Screen reader users should be able to navigate by headings
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('League 1');
    expect(heading).toBeInTheDocument();
  });

  it('renders different league data correctly', () => {
    mockUseLoaderData.mockReturnValue({
      league: {
        ...leagueMock,
        id: 999,
        name: 'Formula 1 Champions League',
        ownerName: 'Max Verstappen',
      },
    });

    render(<League />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Formula 1 Champions League' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
  });

  describe('Share League Invite Dialog', () => {
    it('allows user to open dialog and view invite link', async () => {
      const user = userEvent.setup();
      render(<League />);

      // User clicks invite button
      await user.click(screen.getByRole('button', { name: /invite/i }));

      // User sees dialog with explanation
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Share League Invite')).toBeInTheDocument();
      expect(
        screen.getByText('Anyone who has this link will be able to join your league'),
      ).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading invite link...')).not.toBeInTheDocument();
      });

      // User sees the invite URL they can share
      const inviteUrl = `${window.location.origin}/join/${mockLeagueInvite.token}`;
      expect(screen.getByDisplayValue(inviteUrl)).toBeInTheDocument();
    });

    it('shows loading state while fetching invite link', async () => {
      const user = userEvent.setup();
      mockGetOrCreateLeagueInvite.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockLeagueInvite), 100)),
      );

      render(<League />);
      await user.click(screen.getByRole('button', { name: /invite/i }));

      // User sees loading state
      expect(screen.getByText('Loading invite link...')).toBeInTheDocument();
    });

    it('displays error when invite cannot be loaded', async () => {
      const user = userEvent.setup();
      mockGetOrCreateLeagueInvite.mockRejectedValue(new Error('Network error'));

      render(<League />);
      await user.click(screen.getByRole('button', { name: /invite/i }));

      // User sees error message
      await waitFor(() => {
        expect(screen.getByText('Failed to load invite link')).toBeInTheDocument();
      });

      // Invite link is not shown
      expect(
        screen.queryByDisplayValue(new RegExp(`${window.location.origin}/join/`)),
      ).not.toBeInTheDocument();
    });

    it('caches invite link across dialog reopens', async () => {
      const user = userEvent.setup();
      render(<League />);

      // Open dialog first time
      await user.click(screen.getByRole('button', { name: /invite/i }));
      await waitFor(() => {
        expect(screen.queryByText('Loading invite link...')).not.toBeInTheDocument();
      });

      // Close dialog
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Open dialog again
      await user.click(screen.getByRole('button', { name: /invite/i }));

      // Invite link appears immediately (no loading state, only fetched once)
      const inviteUrl = `${window.location.origin}/join/${mockLeagueInvite.token}`;
      expect(screen.getByDisplayValue(inviteUrl)).toBeInTheDocument();
      expect(screen.queryByText('Loading invite link...')).not.toBeInTheDocument();
      expect(mockGetOrCreateLeagueInvite).toHaveBeenCalledTimes(1);
    });

    it('allows user to copy invite link', async () => {
      const user = userEvent.setup();
      render(<League />);

      await user.click(screen.getByRole('button', { name: /invite/i }));
      await waitFor(() => {
        expect(screen.queryByText('Loading invite link...')).not.toBeInTheDocument();
      });

      // User clicks copy button
      const copyButton = screen.getByRole('button', { name: 'Copy invite link' });
      await user.click(copyButton);

      // Copy function is called with the invite URL
      expect(mockCopy).toHaveBeenCalledWith(
        `${window.location.origin}/join/${mockLeagueInvite.token}`,
      );
    });

    it('provides accessible dialog with keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<League />);

      await user.click(screen.getByRole('button', { name: /invite/i }));
      await waitFor(() => {
        expect(screen.queryByText('Loading invite link...')).not.toBeInTheDocument();
      });

      // Dialog has proper ARIA role
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // User can close with Escape key
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
