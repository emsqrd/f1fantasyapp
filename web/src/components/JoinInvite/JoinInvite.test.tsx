import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { LeagueInvitePreviewResponse } from '@/contracts/LeagueInvitePreviewResponse';
import * as leagueInviteService from '@/services/leagueInviteService';
import { createMockLeague } from '@/test-utils/mockFactories';

import { JoinInvite } from './JoinInvite';

// Mock dependencies
const mockNavigate = vi.fn();
const mockUseLoaderData = vi.fn();
const mockUseParams = vi.fn();
const mockUseAuth = vi.fn();
const mockUseTeam = vi.fn();
const mockAnnounce = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: (opts: unknown) => mockUseLoaderData(opts),
  useParams: (opts: unknown) => mockUseParams(opts),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
    <a href={to} data-search={JSON.stringify(search)}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useTeam', () => ({
  useTeam: () => mockUseTeam(),
}));

vi.mock('@/hooks/useLiveRegion', () => ({
  useLiveRegion: () => ({
    message: '',
    announce: mockAnnounce,
  }),
}));

vi.mock('@/services/leagueInviteService');

describe('JoinInvite', () => {
  const mockToken = 'test-invite-token';
  const mockPreview: LeagueInvitePreviewResponse = {
    leagueName: 'Test League',
    leagueDescription: 'A test league for racing fans',
    ownerName: 'John Doe',
    currentTeamCount: 5,
    maxTeams: 10,
    isLeagueFull: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default setup
    mockUseLoaderData.mockReturnValue({ preview: mockPreview });
    mockUseParams.mockReturnValue({ token: mockToken });
    mockUseAuth.mockReturnValue({ user: null });
    mockUseTeam.mockReturnValue({ hasTeam: false });
  });

  describe('League Preview Display', () => {
    it('displays league name and description', () => {
      render(<JoinInvite />);

      expect(screen.getByText('Test League')).toBeInTheDocument();
      expect(screen.getByText('A test league for racing fans')).toBeInTheDocument();
    });

    it('displays default description when not provided', () => {
      mockUseLoaderData.mockReturnValue({
        preview: { ...mockPreview, leagueDescription: null },
      });

      render(<JoinInvite />);

      expect(screen.getByText('Join this F1 fantasy league')).toBeInTheDocument();
    });

    it('displays owner name and team count', () => {
      render(<JoinInvite />);

      expect(screen.getByText(/Owner:/)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('5 / 10 teams')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated User Flow', () => {
    it('shows sign-in and create account buttons when user is not authenticated', () => {
      render(<JoinInvite />);

      expect(screen.getByRole('link', { name: /sign in to join/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument();
    });

    it('includes redirect URL in sign-in link', () => {
      render(<JoinInvite />);

      const signInLink = screen.getByRole('link', { name: /sign in to join/i });
      expect(signInLink).toHaveAttribute('href', '/sign-in');
      expect(signInLink).toHaveAttribute(
        'data-search',
        JSON.stringify({ redirect: `/join/${mockToken}` })
      );
    });

    it('includes redirect URL in sign-up link', () => {
      render(<JoinInvite />);

      const signUpLink = screen.getByRole('link', { name: /create account/i });
      expect(signUpLink).toHaveAttribute('href', '/sign-up');
      expect(signUpLink).toHaveAttribute(
        'data-search',
        JSON.stringify({ redirect: `/join/${mockToken}` })
      );
    });
  });

  describe('Authenticated User Without Team Flow', () => {
    it('shows create team button when authenticated but no team', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
      mockUseTeam.mockReturnValue({ hasTeam: false });

      render(<JoinInvite />);

      expect(screen.getByRole('link', { name: /create team first/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
    });

    it('includes redirect URL in create team link', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
      mockUseTeam.mockReturnValue({ hasTeam: false });

      render(<JoinInvite />);

      const createTeamLink = screen.getByRole('link', { name: /create team first/i });
      expect(createTeamLink).toHaveAttribute('href', '/create-team');
      expect(createTeamLink).toHaveAttribute(
        'data-search',
        JSON.stringify({ redirect: `/join/${mockToken}` })
      );
    });
  });

  describe('Authenticated User With Team Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
      mockUseTeam.mockReturnValue({ hasTeam: true });
    });

    it('shows join league button when authenticated with team', () => {
      render(<JoinInvite />);

      expect(screen.getByRole('button', { name: /join league/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    });

    it('successfully joins league and navigates to league page', async () => {
      const user = userEvent.setup();
      const mockLeague = createMockLeague({ id: 123, name: 'Test League' });
      vi.mocked(leagueInviteService.joinViaInvite).mockResolvedValue(mockLeague);

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(leagueInviteService.joinViaInvite).toHaveBeenCalledWith(mockToken);
      });

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith('Successfully joined Test League');
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/league/$leagueId',
          params: { leagueId: '123' },
        });
      });
    });

    it('shows loading state while joining', async () => {
      const user = userEvent.setup();
      vi.mocked(leagueInviteService.joinViaInvite).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /joining/i })).toBeInTheDocument();
      });
    });

    it('displays error when join fails with error message', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to join: League is full';
      vi.mocked(leagueInviteService.joinViaInvite).mockRejectedValue(new Error(errorMessage));

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });

      expect(mockAnnounce).toHaveBeenCalledWith(errorMessage);
    });

    it('displays generic error when join fails without error message', async () => {
      const user = userEvent.setup();
      vi.mocked(leagueInviteService.joinViaInvite).mockRejectedValue('Unknown error');

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred');
      });

      expect(mockAnnounce).toHaveBeenCalledWith('An unexpected error occurred');
    });

    it('displays error when join returns null', async () => {
      const user = userEvent.setup();
      vi.mocked(leagueInviteService.joinViaInvite).mockResolvedValue(null);

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to join league');
      });

      expect(mockAnnounce).toHaveBeenCalledWith('Failed to join league');
    });

    it('clears previous error when retrying join', async () => {
      const user = userEvent.setup();
      vi.mocked(leagueInviteService.joinViaInvite)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(createMockLeague());

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });

      // First attempt fails
      await user.click(joinButton);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('First error');
      });

      // Second attempt succeeds
      await user.click(joinButton);
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('League Full State', () => {
    it('displays league full alert when league is at capacity', () => {
      mockUseLoaderData.mockReturnValue({
        preview: { ...mockPreview, isLeagueFull: true },
      });

      render(<JoinInvite />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('This league is full and cannot accept new members.');
    });

    it('hides action buttons when league is full', () => {
      mockUseLoaderData.mockReturnValue({
        preview: { ...mockPreview, isLeagueFull: true },
      });
      mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
      mockUseTeam.mockReturnValue({ hasTeam: true });

      render(<JoinInvite />);

      expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('announces successful join to screen readers', async () => {
      const user = userEvent.setup();
      const mockLeague = createMockLeague({ name: 'Accessible League' });
      vi.mocked(leagueInviteService.joinViaInvite).mockResolvedValue(mockLeague);

      mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
      mockUseTeam.mockReturnValue({ hasTeam: true });

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith('Successfully joined Accessible League');
      });
    });

    it('announces errors to screen readers', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Network error occurred';
      vi.mocked(leagueInviteService.joinViaInvite).mockRejectedValue(new Error(errorMessage));

      mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
      mockUseTeam.mockReturnValue({ hasTeam: true });

      render(<JoinInvite />);

      const joinButton = screen.getByRole('button', { name: /join league/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('uses proper ARIA attributes for league full alert', () => {
      mockUseLoaderData.mockReturnValue({
        preview: { ...mockPreview, isLeagueFull: true },
      });

      render(<JoinInvite />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });
});
