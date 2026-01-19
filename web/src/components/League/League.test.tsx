import type { League as LeagueType } from '@/contracts/League';
import { createMockLeague } from '@/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { League } from './League';

// Mock the Leaderboard component since League is primarily a layout/container component
vi.mock('../Leaderboard/Leaderboard', () => ({
  Leaderboard: () => <div data-testid="leaderboard">Mocked Leaderboard</div>,
}));

// Mock TanStack Router hooks
const mockUseLoaderData = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: (opts: { from: string }) => mockUseLoaderData(opts),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const leagueMock: LeagueType = createMockLeague();

describe('League', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: mock loader data with league
    mockUseLoaderData.mockReturnValue({
      league: leagueMock,
    });
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

  it('displays back to leagues navigation link', () => {
    render(<League />);

    const backLink = screen.getByRole('link', { name: /back to my leagues/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/leagues');
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
});
