import type { RaceWeekend } from '@/contracts/RaceWeekend';
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

// Home composes MyLeaguesList (a standings data-owner) only in the summary-present
// branch, so that surface is covered in the integration flow; this file owns the
// no-team branch, which needs no Query client.
function renderHome(overrides: Partial<ComponentProps<typeof Home>> = {}) {
  return render(<Home name="Ada" summary={null} races={[] as RaceWeekend[]} {...overrides} />);
}

describe('Home', () => {
  describe('identity header', () => {
    it('renders only the welcome heading when the user has no team', () => {
      renderHome({ summary: null });

      expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
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
