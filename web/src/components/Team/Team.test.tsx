import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import { createMockConstructor, createMockDriver, createMockTeam } from '@/tests/test-utils';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  describe('Lock countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "Lineup Locked" when deadline has passed', () => {
      render(
        <TeamView
          team={createMockTeam()}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={makeRacesWithDeadline('2026-02-01T12:00:00Z')}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
    });

    it('formats countdown with days when more than 24h remain', () => {
      render(
        <TeamView
          team={createMockTeam()}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={makeRacesWithDeadline('2026-03-08T12:00:00Z')}
          readOnly={false}
        />,
      );

      expect(screen.getByText('12d 00h 00m')).toBeInTheDocument();
    });

    it('formats countdown without days when less than 24h remain', () => {
      render(
        <TeamView
          team={createMockTeam()}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={makeRacesWithDeadline('2026-02-24T15:30:00Z')}
          readOnly={false}
        />,
      );

      expect(screen.getByText('03h 30m')).toBeInTheDocument();
    });

    it('shows "Less than 1 minute" when lock is imminent', () => {
      render(
        <TeamView
          team={createMockTeam()}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={makeRacesWithDeadline('2026-02-24T12:00:30Z')}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Less than 1 minute')).toBeInTheDocument();
    });

    it('omits lock display when no deadline is set', () => {
      render(
        <TeamView
          team={createMockTeam()}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={makeRacesWithDeadline(null)}
          readOnly={false}
        />,
      );

      expect(screen.queryByText('Lineup Locked')).not.toBeInTheDocument();
      expect(screen.queryByText('Lineup Locks In')).not.toBeInTheDocument();
    });
  });
});
