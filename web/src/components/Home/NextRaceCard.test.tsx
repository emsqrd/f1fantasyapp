import type { RaceWeekend } from '@/contracts/RaceWeekend';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NextRaceCard } from './NextRaceCard';

const NOW = new Date('2026-05-24T12:00:00Z');

function makeRace(overrides: Partial<RaceWeekend> = {}): RaceWeekend {
  return {
    id: 1,
    seasonId: 1,
    round: 7,
    name: 'Monaco Grand Prix',
    circuit: {
      id: 1,
      name: 'Circuit de Monaco',
      location: 'Monte Carlo',
      country: 'Monaco',
    },
    raceDate: '2026-05-31',
    lockDeadline: new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    isCurrent: true,
    weekendFormat: 0,
    ...overrides,
  };
}

describe('NextRaceCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the current race with countdown to the lock deadline', () => {
    const races = [
      makeRace({ round: 6, name: 'Spanish Grand Prix', isCurrent: false }),
      makeRace(),
    ];

    render(<NextRaceCard races={races} />);

    expect(screen.getByRole('heading', { name: 'Monaco Grand Prix' })).toBeInTheDocument();
    expect(screen.getByText(/Round 7/)).toBeInTheDocument();
    expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('renders the season-complete fallback when no race is current', () => {
    const races = [
      makeRace({
        round: 23,
        name: 'Abu Dhabi Grand Prix',
        raceDate: '2026-12-06',
        isCurrent: false,
      }),
    ];

    render(<NextRaceCard races={races} />);

    expect(screen.getByText(/Season complete/)).toBeInTheDocument();
    expect(screen.getByText('Abu Dhabi Grand Prix')).toBeInTheDocument();
    expect(screen.queryByText('Lineup locks in')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Abu Dhabi Grand Prix' })).not.toBeInTheDocument();
  });
});
