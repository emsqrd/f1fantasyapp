import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { TeamSummary } from '@/contracts/TeamSummary';
import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Home } from './Home';

// A present summary means the user has a team; its fields may still be null
// before any race is scored. A null summary means no team.
const noScoresSummary: TeamSummary = {
  teamName: 'Red Bull Racing',
  seasonTotalPoints: null,
  lastRace: null,
};

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
      summary={null}
      standings={[] as MyLeagueStanding[]}
      races={[] as RaceWeekend[]}
      {...overrides}
    />,
  );
}

describe('Home', () => {
  describe('identity header', () => {
    it('renders "Welcome back" and the team name when the user has a team', () => {
      renderHome({ summary: noScoresSummary });

      expect(screen.getByText('Welcome back, Ada')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    });

    it('renders only the welcome heading when the user has no team', () => {
      renderHome({ summary: null });

      expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    });
  });

  describe('score cards', () => {
    it('renders last-race and season values when summary has data', () => {
      const summary: TeamSummary = {
        teamName: 'Grid Gladiators',
        seasonTotalPoints: 312,
        lastRace: { round: 7, name: 'Monaco Grand Prix', totalScore: 47 },
      };

      renderHome({ summary });

      expect(screen.getByText('Monaco Grand Prix')).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument();
      expect(screen.getByText('312')).toBeInTheDocument();
      expect(screen.getAllByText('pts')).toHaveLength(2);
      expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Leagues unlock with a team')).not.toBeInTheDocument();
    });

    it('renders em-dashes and no "pts" suffix when the team has no scores yet', () => {
      renderHome({ summary: noScoresSummary });

      // 1 em-dash for the last-race title + 2 for the missing scores.
      expect(screen.getAllByText('—')).toHaveLength(3);
      expect(screen.queryByText('pts')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Leagues unlock with a team')).not.toBeInTheDocument();
    });
  });

  describe('leagues list', () => {
    const standings: MyLeagueStanding[] = [
      { leagueId: 12, leagueName: 'Cota 2026', totalTeams: 8, position: 3, totalPoints: 184 },
      { leagueId: 34, leagueName: 'Monaco Masters', totalTeams: 12, position: 5, totalPoints: 150 },
    ];

    it('renders the My Leagues list when standings are present', () => {
      renderHome({ summary: noScoresSummary, standings });

      expect(screen.getByRole('heading', { name: 'My Leagues' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'My Leagues' })).toBeInTheDocument();
      expect(screen.queryByText("You're riding solo")).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Leagues unlock with a team')).not.toBeInTheDocument();
    });
  });

  describe('no-leagues state', () => {
    it('renders the join-leagues prompt with a browse CTA for a team with no standings', () => {
      renderHome({ summary: noScoresSummary, standings: [] });

      expect(screen.getByText("You're riding solo")).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Browse leagues' })).toHaveAttribute(
        'href',
        '/browse-leagues',
      );

      expect(screen.queryByRole('heading', { name: 'My Leagues' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'My Leagues' })).not.toBeInTheDocument();
      expect(screen.queryByText('Leagues unlock with a team')).not.toBeInTheDocument();
    });
  });

  describe('no-team state', () => {
    it('renders the create-team hero and leagues notice, and no score cards', () => {
      renderHome({ summary: null });

      const createTeamLink = screen.getByRole('link', { name: /create team/i });
      expect(createTeamLink).toHaveAttribute('href', '/create-team');

      expect(screen.getByText('Leagues unlock with a team')).toBeInTheDocument();

      expect(screen.queryByText('Season stats')).not.toBeInTheDocument();
      expect(screen.queryByText('Last race stats')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'My Leagues' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'My Leagues' })).not.toBeInTheDocument();
    });
  });
});
