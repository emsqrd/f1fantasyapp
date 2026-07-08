import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import { createMockConstructor, createMockDriver, createMockTeam } from '@/tests/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { TeamView } from './Team';

const mockActiveDrivers: Driver[] = [createMockDriver({ id: 1 })];
const mockActiveConstructors: Constructor[] = [createMockConstructor({ id: 1 })];

function makeRaces(overrides: Partial<RaceWeekend> = {}): RaceWeekend[] {
  return [
    {
      id: 1,
      seasonId: 1,
      round: 2,
      name: 'Saudi Arabian Grand Prix',
      circuit: {
        id: 1,
        name: 'Jeddah Corniche Circuit',
        location: 'Jeddah',
        country: 'Saudi Arabia',
      },
      raceDate: '2099-01-03',
      lockDeadline: null,
      isCurrent: true,
      weekendFormat: 0,
      ...overrides,
    },
  ];
}

// TeamView reaches the Query cache through `useSetCaptain`, so it needs a client.
function renderTeamView(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderWithRaces(races: RaceWeekend[], { readOnly = false } = {}) {
  return renderTeamView(
    <TeamView
      team={createMockTeam()}
      activeDrivers={mockActiveDrivers}
      activeConstructors={mockActiveConstructors}
      races={races}
      readOnly={readOnly}
    />,
  );
}

describe('TeamView', () => {
  it('shows owner name when readOnly is true', () => {
    const team = createMockTeam({ name: 'Test Team', ownerName: 'Test Owner' });

    renderTeamView(
      <TeamView
        team={team}
        activeDrivers={mockActiveDrivers}
        activeConstructors={mockActiveConstructors}
        races={makeRaces()}
        readOnly={true}
      />,
    );

    expect(screen.getByText('Test Owner')).toBeInTheDocument();
  });

  it('does not show owner name when readOnly is false', () => {
    const team = createMockTeam({ name: 'Test Team', ownerName: 'Test Owner' });

    renderTeamView(
      <TeamView
        team={team}
        activeDrivers={mockActiveDrivers}
        activeConstructors={mockActiveConstructors}
        races={makeRaces()}
        readOnly={false}
      />,
    );

    expect(screen.queryByText('Test Owner')).not.toBeInTheDocument();
  });

  it('shows current race round and name in subtitle', () => {
    renderWithRaces(makeRaces());

    expect(screen.getByText('Round 2 · Saudi Arabian Grand Prix')).toBeInTheDocument();
  });

  it('shows the countdown and lineup edit affordances before the lock deadline', () => {
    renderWithRaces(makeRaces({ lockDeadline: '2099-01-01T00:00:00Z' }));

    expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add driver/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /add constructor/i }).length).toBeGreaterThan(0);
  });

  it('hides edit affordances on a read-only team even before the lock deadline', () => {
    renderWithRaces(makeRaces({ lockDeadline: '2099-01-01T00:00:00Z' }), { readOnly: true });

    expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
  });

  it('shows Lineup Locked and hides edit affordances once the deadline passes', () => {
    renderWithRaces(makeRaces({ lockDeadline: '2020-05-31T12:00:00Z' }));

    expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
  });

  it('hides the lock status and edit affordances once the race has run', () => {
    renderWithRaces(makeRaces({ raceDate: '2020-06-01', lockDeadline: '2020-05-31T12:00:00Z' }));

    expect(screen.queryByText('Lineup Locked')).not.toBeInTheDocument();
    expect(screen.queryByText('Lineup locks in')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
  });

  it('falls back to Lineup Locked on the final race when the season is complete', () => {
    renderWithRaces(
      makeRaces({ isCurrent: false, raceDate: '2020-06-01', lockDeadline: '2020-05-31T12:00:00Z' }),
    );

    expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
  });
});
