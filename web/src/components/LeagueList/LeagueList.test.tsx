import type { League } from '@/contracts/League';
import { createMockLeagueList } from '@/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LeagueList } from './LeagueList';

// Mock TanStack Router hooks
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
    <a href={to.replace(`$leagueId`, params?.leagueId || '')} {...props}>
      {children}
    </a>
  ),
}));

const leaguesMock: League[] = createMockLeagueList(3);

describe('LeagueList', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: mock loader data with leagues
    mockUseLoaderData.mockReturnValue({
      leagues: leaguesMock,
    });
  });

  it('displays leagues from loader data', () => {
    render(<LeagueList />);

    // Leagues should be displayed immediately (no loading state)
    expect(screen.getByText('League 1')).toBeInTheDocument();
    expect(screen.getByText('League 2')).toBeInTheDocument();
  });

  it('displays empty league list when no leagues exist', () => {
    mockUseLoaderData.mockReturnValue({
      leagues: [],
    });

    render(<LeagueList />);

    // But no league items should be present
    expect(screen.queryByText('League 1')).not.toBeInTheDocument();
  });

  it('renders league links with type-safe navigation', () => {
    render(<LeagueList />);

    const leagueLink = screen.getByRole('link', { name: /view league: league 1/i });
    expect(leagueLink).toBeInTheDocument();
    expect(leagueLink).toHaveAttribute('href', '/league/1');
  });
});
