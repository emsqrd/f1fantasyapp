import { createMockTeam } from '@/test-utils';
import { createMockLeague } from '@/test-utils/mockFactories';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Leaderboard } from './Leaderboard';

const mockNavigate = vi.fn();
const mockUseLoaderData = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLoaderData: (opts: { from: string }) => mockUseLoaderData(opts),
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a href={to.replace(`$teamId`, params?.teamId || '')} {...props}>
      {children}
    </a>
  ),
}));

describe('Leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Leaderboard display', () => {
    it('displays all teams with their information', () => {
      mockUseLoaderData.mockReturnValue({
        league: createMockLeague({
          teams: [
            createMockTeam({ id: 1, name: 'Test Team 1', ownerName: 'Test Owner 1' }),
            createMockTeam({ id: 2, name: 'Test Team 2', ownerName: 'Test Owner 2' }),
          ],
        }),
      });

      render(<Leaderboard />);

      expect(screen.getByText('Test Team 1')).toBeInTheDocument();
      expect(screen.getByText('Test Owner 1')).toBeInTheDocument();
      expect(screen.getByText('Test Team 2')).toBeInTheDocument();
      expect(screen.getByText('Test Owner 2')).toBeInTheDocument();
    });

    it('displays empty teams message when there are no teams in the league', () => {
      mockUseLoaderData.mockReturnValue({
        league: createMockLeague({
          teams: [],
        }),
      });

      render(<Leaderboard />);

      expect(screen.getByText('No teams in this league yet.')).toBeInTheDocument();
    });

    it('displays teams even when some data is missing', () => {
      mockUseLoaderData.mockReturnValue({
        league: createMockLeague({
          teams: [
            createMockTeam({ id: 1, name: 'Complete Team', ownerName: 'Complete Owner' }),
            createMockTeam({ id: 2, name: '', ownerName: 'Owner Only' }),
            createMockTeam({ id: 3, name: 'Team Only', ownerName: '' }),
          ],
        }),
      });

      render(<Leaderboard />);

      const rows = screen.getAllByRole('row').slice(1); // Skip header row
      expect(rows).toHaveLength(3);

      // First team - complete data
      const firstRowCells = within(rows[0]).getAllByRole('cell');
      expect(firstRowCells[0]).toHaveTextContent('1');
      expect(within(rows[0]).getByText('Complete Team')).toBeInTheDocument();
      expect(within(rows[0]).getByText('Complete Owner')).toBeInTheDocument();

      // Second team - missing name (displays empty string)
      const secondRowCells = within(rows[1]).getAllByRole('cell');
      expect(secondRowCells[0]).toHaveTextContent('2');
      expect(within(rows[1]).getByText('Owner Only')).toBeInTheDocument();

      // Third team - missing owner (displays empty string)
      const thirdRowCells = within(rows[2]).getAllByRole('cell');
      expect(thirdRowCells[0]).toHaveTextContent('3');
      expect(within(rows[2]).getByText('Team Only')).toBeInTheDocument();
    });

    it('renders team links with type-safe navigation', async () => {
      mockUseLoaderData.mockReturnValue({
        league: createMockLeague({
          teams: [createMockTeam({ id: 42, name: 'My Team' })],
        }),
      });

      render(<Leaderboard />);

      const teamLink = await screen.findByRole('link', { name: /view team: my team/i });
      expect(teamLink).toHaveAttribute('href', '/team/42');
    });

    it('allows keyboard navigation through team links', async () => {
      const user = userEvent.setup();

      mockUseLoaderData.mockReturnValue({
        league: createMockLeague({
          teams: [
            createMockTeam({ id: 1, name: 'First Team', ownerName: 'Owner 1' }),
            createMockTeam({ id: 2, name: 'Second Team', ownerName: 'Owner 2' }),
            createMockTeam({ id: 3, name: 'Third Team', ownerName: 'Owner 3' }),
          ],
        }),
      });

      render(<Leaderboard />);

      const firstLink = screen.getByRole('link', { name: /view team: first team/i });
      const secondLink = screen.getByRole('link', { name: /view team: second team/i });
      const thirdLink = screen.getByRole('link', { name: /view team: third team/i });

      // Tab to first link
      await user.tab();
      expect(firstLink).toHaveFocus();

      // Tab to second link
      await user.tab();
      expect(secondLink).toHaveFocus();

      // Tab to third link
      await user.tab();
      expect(thirdLink).toHaveFocus();
    });

    it('renders accessible table structure', () => {
      mockUseLoaderData.mockReturnValue({
        league: createMockLeague({
          teams: [createMockTeam({ id: 1, name: 'Test Team', ownerName: 'Test Owner' })],
        }),
      });

      render(<Leaderboard />);

      // Verify table and headers exist with proper roles
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(2);
      expect(columnHeaders[0]).toHaveTextContent('Rank');
      expect(columnHeaders[1]).toHaveTextContent('Team');
    });
  });
});
