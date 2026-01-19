import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Sentry from '@sentry/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockLeague } from '@/test-utils/mockFactories';

import { BrowseLeagues } from './BrowseLeagues';

// Mock dependencies
vi.mock('@tanstack/react-router', () => ({
  useLoaderData: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock('@/services/leagueService', () => ({
  joinLeague: vi.fn(),
}));

vi.mock('@/hooks/useLiveRegion', () => ({
  useLiveRegion: vi.fn(),
}));

vi.mock('@sentry/react', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@sentry/react');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Import mocked modules
const { useLoaderData, useNavigate } = await import('@tanstack/react-router');
const { joinLeague } = await import('@/services/leagueService');
const { useLiveRegion } = await import('@/hooks/useLiveRegion');

describe('BrowseLeagues', () => {
  const mockNavigate = vi.fn();
  const mockAnnounce = vi.fn();

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLiveRegion).mockReturnValue({
      message: '',
      announce: mockAnnounce,
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('displays empty state message when no leagues are available', () => {
      vi.mocked(useLoaderData).mockReturnValue({
        leagues: [],
      });

      render(<BrowseLeagues />);

      expect(screen.getByText('Available Leagues')).toBeInTheDocument();
      expect(screen.getByText('There are no available leagues to display')).toBeInTheDocument();
      expect(screen.queryByLabelText('available-leagues')).not.toBeInTheDocument();
    });
  });

  describe('League List Display', () => {
    it('renders multiple leagues with correct information', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'F1 Champions',
          description: 'Best league ever',
          isPrivate: false,
          teamCount: 5,
          maxTeams: 10,
        }),
        createMockLeague({
          id: 2,
          name: 'Private Racing',
          description: 'Invite only',
          isPrivate: true,
          teamCount: 3,
          maxTeams: 8,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      // League names
      expect(screen.getByText('F1 Champions')).toBeInTheDocument();
      expect(screen.getByText('Private Racing')).toBeInTheDocument();

      // Descriptions
      expect(screen.getByText('Best league ever')).toBeInTheDocument();
      expect(screen.getByText('Invite only')).toBeInTheDocument();

      // Member counts
      expect(screen.getByText('5 / 10 members')).toBeInTheDocument();
      expect(screen.getByText('3 / 8 members')).toBeInTheDocument();
    });

    it('displays public badge for public leagues', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Public League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const publicBadge = screen.getByText('Public');
      expect(publicBadge).toBeInTheDocument();
      expect(screen.queryByText('Private')).not.toBeInTheDocument();
    });

    it('displays private badge for private leagues', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Private League',
          isPrivate: true,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const privateBadge = screen.getByText('Private');
      expect(privateBadge).toBeInTheDocument();
      expect(screen.queryByText('Public')).not.toBeInTheDocument();
    });

    it('renders league without description when description is empty', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'No Description League',
          description: '',
          teamCount: 2,
          maxTeams: 5,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      const { container } = render(<BrowseLeagues />);

      expect(screen.getByText('No Description League')).toBeInTheDocument();
      expect(screen.getByText('2 / 5 members')).toBeInTheDocument();

      // Description paragraph should not be rendered for empty description
      const descriptionElements = container.querySelectorAll('.text-muted-foreground.mb-4.text-sm');
      expect(descriptionElements).toHaveLength(0);
    });
  });

  describe('Join League Button Behavior', () => {
    it('disables join button for private leagues', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Private League',
          isPrivate: true,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      expect(joinButton).toBeDisabled();
    });

    it('enables join button for public leagues', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Public League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      expect(joinButton).toBeEnabled();
    });
  });

  describe('Join League Dialog', () => {
    it('opens confirmation dialog when join button is clicked', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      expect(await screen.findByText('Join Test League?')).toBeInTheDocument();
      expect(
        screen.getByText(/You're about to join this league. You can manage your league memberships/i),
      ).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm join/i })).toBeInTheDocument();
    });

    it('closes dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Join Test League?')).not.toBeInTheDocument();
      });
    });

    it('closes dialog automatically after join error', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockRejectedValueOnce(new Error('Network error'));

      render(<BrowseLeagues />);

      // Open dialog and trigger error
      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      // Error appears
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Dialog should close automatically
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /confirm join/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Successful Join League', () => {
    it('calls joinLeague service with correct league ID', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 42,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockResolvedValueOnce(leagues[0]);

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(joinLeague).toHaveBeenCalledWith(42);
      });
    });

    it('navigates to league detail page after successful join', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 123,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockResolvedValueOnce(leagues[0]);

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/league/$leagueId',
          params: { leagueId: '123' },
        });
      });
    });

    it('logs successful join to Sentry', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockResolvedValueOnce(leagues[0]);

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(Sentry.logger.info).toHaveBeenCalledWith('User joined league from browse page', {
          leagueId: 1,
          leagueName: 'Test League',
        });
      });
    });
  });

  describe('Join League Error Handling', () => {
    it('displays error message when join fails with Error instance', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockRejectedValueOnce(new Error('Already a member'));

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Already a member')).toBeInTheDocument();
      });
    });

    it('displays generic error message when join fails with non-Error', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockRejectedValueOnce('Unknown error');

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to join league. Please try again.')).toBeInTheDocument();
      });
    });

    it('announces error to screen readers via LiveRegion', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockRejectedValueOnce(new Error('Network error'));

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith('Network error');
      });
    });

    it('logs error to Sentry when join fails', async () => {
      const user = userEvent.setup();
      const testError = new Error('Network error');
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockRejectedValueOnce(testError);

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(Sentry.logger.error).toHaveBeenCalledWith('Failed to join league from browse page', {
          leagueId: 1,
          leagueName: 'Test League',
          error: testError,
        });
      });
    });

    it('does not navigate when join fails', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(joinLeague).mockRejectedValueOnce(new Error('Failed'));

      render(<BrowseLeagues />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm join/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Leagues Interaction', () => {
    it('opens correct dialog for each league', async () => {
      const user = userEvent.setup();
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'League One',
          isPrivate: false,
        }),
        createMockLeague({
          id: 2,
          name: 'League Two',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const joinButtons = screen.getAllByRole('button', { name: /join league/i });

      // Click first league's join button
      await user.click(joinButtons[0]);
      expect(await screen.findByText('Join League One?')).toBeInTheDocument();

      // Cancel and try second league
      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await user.click(joinButtons[1]);
      expect(await screen.findByText('Join League Two?')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders LiveRegion for screen reader announcements', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });
      vi.mocked(useLiveRegion).mockReturnValue({
        message: 'Test announcement',
        announce: mockAnnounce,
        clear: vi.fn(),
      });

      render(<BrowseLeagues />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent('Test announcement');
    });

    it('uses semantic HTML with proper heading structure', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const mainHeading = screen.getByRole('heading', { level: 2, name: /available leagues/i });
      expect(mainHeading).toBeInTheDocument();

      const leagueHeading = screen.getByRole('heading', { level: 3, name: /test league/i });
      expect(leagueHeading).toBeInTheDocument();
    });

    it('provides aria-label for leagues list container', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      render(<BrowseLeagues />);

      const leaguesList = screen.getByLabelText('available-leagues');
      expect(leaguesList).toBeInTheDocument();
    });

    it('hides decorative icons from screen readers', () => {
      const leagues = [
        createMockLeague({
          id: 1,
          name: 'Test League',
          isPrivate: false,
          teamCount: 5,
          maxTeams: 10,
        }),
      ];

      vi.mocked(useLoaderData).mockReturnValue({ leagues });

      const { container } = render(<BrowseLeagues />);

      // Icons should have aria-hidden="true"
      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
