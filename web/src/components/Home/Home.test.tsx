import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { TeamSummary } from '@/contracts/TeamSummary';
import { createMockTeam } from '@/tests/test-utils';
import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Home } from './Home';

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

function renderHome(overrides: Partial<ComponentProps<typeof Home>> = {}) {
  return render(
    <Home
      name="Ada"
      team={null}
      summary={null}
      standings={[] as MyLeagueStanding[]}
      races={[] as RaceWeekend[]}
      {...overrides}
    />,
  );
}

describe('Home', () => {
  describe('identity header', () => {
    it('renders "Welcome back" and the team name when a team is present', () => {
      renderHome({ team: createMockTeam({ name: 'Red Bull Racing' }) });

      expect(screen.getByText('Welcome back, Ada')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    });

    it('renders only the welcome heading when no team is present', () => {
      renderHome({ team: null });

      expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    });
  });

  describe('score cards', () => {
    it('renders last-race and season values when summary has data', () => {
      const summary: TeamSummary = {
        seasonTotalPoints: 312,
        lastRace: { round: 7, name: 'Monaco Grand Prix', totalScore: 47 },
      };

      renderHome({ summary });

      expect(screen.getByText('Monaco Grand Prix')).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument();
      expect(screen.getByText('312')).toBeInTheDocument();
      expect(screen.getAllByText('pts')).toHaveLength(2);
    });

    it('renders em-dashes and no "pts" suffix when summary is null', () => {
      renderHome({ summary: null });

      // 1 em-dash for the last-race title + 2 for the missing scores.
      expect(screen.getAllByText('—')).toHaveLength(3);
      expect(screen.queryByText('pts')).not.toBeInTheDocument();
    });
  });

  describe('leagues list', () => {
    const standings: MyLeagueStanding[] = [
      { leagueId: 12, leagueName: 'Cota 2026', totalTeams: 8, position: 3, totalPoints: 184 },
      { leagueId: 34, leagueName: 'Monaco Masters', totalTeams: 12, position: 5, totalPoints: 150 },
    ];

    it('renders the leagues section with a row link and the position when standings are present', () => {
      renderHome({ standings });

      expect(screen.getByRole('heading', { name: 'My Leagues' })).toBeInTheDocument();
      const row = screen.getByRole('link', { name: /Open Cota 2026/i });
      expect(row).toHaveAttribute('href', '/league/12');
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('does not render the leagues section when standings are empty', () => {
      renderHome({ standings: [] });

      expect(screen.queryByRole('heading', { name: 'My Leagues' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'My Leagues' })).not.toBeInTheDocument();
    });
  });
});
