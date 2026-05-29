import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import { createMockConstructor, createMockDriver, createMockTeam } from '@/tests/test-utils';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TeamView } from './Team';

vi.mock('../DriverPicker/DriverPicker', () => ({
  DriverPicker: () => null,
}));

vi.mock('../ConstructorPicker/ConstructorPicker', () => ({
  ConstructorPicker: () => null,
}));

const mockActiveDrivers: Driver[] = [createMockDriver({ id: 1 })];
const mockActiveConstructors: Constructor[] = [createMockConstructor({ id: 1 })];

const mockRaces: RaceWeekend[] = [
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
    raceDate: '2024-03-09',
    lockDeadline: null,
    isCurrent: true,
    weekendFormat: 0,
  },
];

function makeRacesWithDeadline(deadline: string | null): RaceWeekend[] {
  return mockRaces.map((race) => ({ ...race, lockDeadline: deadline }));
}

describe('TeamView', () => {
  it('shows owner name when readOnly is true', () => {
    const team = createMockTeam({ name: 'Test Team', ownerName: 'Test Owner' });

    render(
      <TeamView
        team={team}
        activeDrivers={mockActiveDrivers}
        activeConstructors={mockActiveConstructors}
        races={mockRaces}
        readOnly={true}
      />,
    );

    expect(screen.getByText('Test Owner')).toBeInTheDocument();
  });

  it('does not show owner name when readOnly is false', () => {
    const team = createMockTeam({ name: 'Test Team', ownerName: 'Test Owner' });

    render(
      <TeamView
        team={team}
        activeDrivers={mockActiveDrivers}
        activeConstructors={mockActiveConstructors}
        races={mockRaces}
        readOnly={false}
      />,
    );

    expect(screen.queryByText('Test Owner')).not.toBeInTheDocument();
  });

  it('shows current race round and name in subtitle', () => {
    render(
      <TeamView
        team={createMockTeam()}
        activeDrivers={mockActiveDrivers}
        activeConstructors={mockActiveConstructors}
        races={mockRaces}
        readOnly={false}
      />,
    );

    expect(screen.getByText('Round 2 · Saudi Arabian Grand Prix')).toBeInTheDocument();
  });

  it('renders the lock countdown for the current race', () => {
    render(
      <TeamView
        team={createMockTeam()}
        activeDrivers={mockActiveDrivers}
        activeConstructors={mockActiveConstructors}
        races={makeRacesWithDeadline('2099-01-01T00:00:00Z')}
        readOnly={false}
      />,
    );

    expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
  });
});
