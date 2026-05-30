import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyLeaguesList } from './MyLeaguesList';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: ReactNode;
      to: string;
      params?: Record<string, string>;
    }) => (
      <a href={to.replace('$leagueId', params?.leagueId ?? '')} {...props}>
        {children}
      </a>
    ),
  };
});

describe('MyLeaguesList', () => {
  it('renders a row as a link to the league with its name and position', () => {
    const standings: MyLeagueStanding[] = [
      { leagueId: 12, leagueName: 'Cota 2026', totalTeams: 8, position: 3, totalPoints: 184 },
    ];

    render(<MyLeaguesList standings={standings} />);

    const row = screen.getByRole('link', { name: /Open Cota 2026/i });
    expect(row).toHaveAttribute('href', '/league/12');
    expect(screen.getByText('Cota 2026')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders an em-dash when a position is null', () => {
    const standings: MyLeagueStanding[] = [
      {
        leagueId: 34,
        leagueName: 'Monaco Masters',
        totalTeams: 12,
        position: null,
        totalPoints: null,
      },
    ];

    render(<MyLeaguesList standings={standings} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders nothing when standings are empty', () => {
    const { container } = render(<MyLeaguesList standings={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('list', { name: 'My Leagues' })).not.toBeInTheDocument();
  });
});
