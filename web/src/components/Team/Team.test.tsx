import type { Race } from '@/contracts/Race';
import type { Constructor, Driver } from '@/contracts/Role';
import type { Team as TeamType } from '@/contracts/Team';
import { setCaptain } from '@/services/teamService';
import { createMockConstructor, createMockDriver, createMockTeam } from '@/test-utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Team } from './Team';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

// Mock teamService
vi.mock('@/services/teamService', () => ({
  setCaptain: vi.fn(),
}));

// Mock ResizeObserver for Radix UI components
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Mock child components to isolate Team component testing
const mockDriverPicker = vi.fn();
vi.mock('../DriverPicker/DriverPicker', () => ({
  DriverPicker: (props: {
    activeDrivers: Driver[];
    teamDrivers?: unknown[];
    readOnly: boolean;
    remainingBudget: number;
    captainDriverId?: number | null;
    onSetCaptain?: (driverId: number | null) => void;
  }) => {
    mockDriverPicker(props);
    return (
      <div
        data-testid="driver-picker"
        data-read-only={props.readOnly}
        data-active-drivers={props.activeDrivers.length}
      >
        Mocked DriverPicker (readOnly: {props.readOnly.toString()})
        {props.onSetCaptain && (
          <button onClick={() => props.onSetCaptain!(1)}>Trigger Captain</button>
        )}
      </div>
    );
  },
}));

const mockConstructorPicker = vi.fn();
vi.mock('../ConstructorPicker/ConstructorPicker', () => ({
  ConstructorPicker: (props: {
    activeConstructors: Constructor[];
    teamConstructors?: unknown[];
    readOnly: boolean;
    remainingBudget: number;
  }) => {
    mockConstructorPicker(props);
    return (
      <div
        data-testid="constructor-picker"
        data-read-only={props.readOnly}
        data-active-constructors={props.activeConstructors.length}
      >
        Mocked ConstructorPicker (readOnly: {props.readOnly.toString()})
      </div>
    );
  },
}));

describe('Team Component', () => {
  const mockTeam: TeamType = createMockTeam({
    id: 1,
    name: 'Test Team',
    ownerId: 1,
    ownerName: 'Test Owner',
  });

  const mockActiveDrivers = [
    createMockDriver({
      id: 1,
      firstName: 'Max',
      lastName: 'Verstappen',
      countryAbbreviation: 'NL',
    }),
    createMockDriver({
      id: 2,
      firstName: 'Lewis',
      lastName: 'Hamilton',
      countryAbbreviation: 'GB',
    }),
    createMockDriver({
      id: 3,
      firstName: 'Charles',
      lastName: 'Leclerc',
      countryAbbreviation: 'MC',
    }),
  ];

  const mockActiveConstructors = [
    createMockConstructor({
      id: 1,
      name: 'Red Bull',
      fullName: 'Red Bull Racing',
      countryAbbreviation: 'AT',
    }),
    createMockConstructor({
      id: 2,
      name: 'Ferrari',
      fullName: 'Scuderia Ferrari',
      countryAbbreviation: 'IT',
    }),
  ];

  const mockRaces: Race[] = [
    {
      id: 1,
      seasonId: 1,
      round: 1,
      name: 'Bahrain Grand Prix',
      circuit: {
        id: 1,
        name: 'Bahrain International Circuit',
        location: 'Sakhir',
        country: 'Bahrain',
      },
      raceDate: '2024-03-02',
      lockDeadline: '2024-03-01T12:00:00Z',
      isCurrent: false,
      weekendFormat: 0,
    },
    {
      id: 2,
      seasonId: 1,
      round: 2,
      name: 'Saudi Arabian Grand Prix',
      circuit: {
        id: 2,
        name: 'Jeddah Corniche Circuit',
        location: 'Jeddah',
        country: 'Saudi Arabia',
      },
      raceDate: '2024-03-09',
      lockDeadline: null,
      isCurrent: true,
      weekendFormat: 0,
    },
    {
      id: 3,
      seasonId: 1,
      round: 3,
      name: 'Australian Grand Prix',
      circuit: { id: 3, name: 'Albert Park Circuit', location: 'Melbourne', country: 'Australia' },
      raceDate: '2024-03-24',
      lockDeadline: '2024-03-23T12:00:00Z',
      isCurrent: false,
      weekendFormat: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('renders team name', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    it('displays formatted remaining budget in millions', () => {
      const team = createMockTeam({ remainingBudget: 75_400_000 });
      render(
        <Team
          team={team}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(screen.getByText('$75.4M')).toBeInTheDocument();
    });

    it('displays sub-million remaining budget in thousands', () => {
      const team = createMockTeam({ remainingBudget: 900_000 });
      render(
        <Team
          team={team}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(screen.getByText('$900k')).toBeInTheDocument();
    });
  });

  describe('Unified Layout', () => {
    it('renders both driver and constructor pickers simultaneously', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(screen.getByTestId('driver-picker')).toBeInTheDocument();
      expect(screen.getByTestId('constructor-picker')).toBeInTheDocument();
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).toBeVisible();
    });

    it('shows race subtitle with round and race name', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      // Current race is Round 2 - Saudi Arabian Grand Prix
      expect(screen.getByText('Round 2 · Saudi Arabian Grand Prix')).toBeInTheDocument();
    });

    it('renders captain error above driver picker when captain update fails', async () => {
      const user = userEvent.setup();
      vi.mocked(setCaptain).mockRejectedValueOnce(new Error('Captain update failed'));

      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Trigger Captain' }));

      const errorElement = await screen.findByRole('alert');
      expect(errorElement).toHaveTextContent('Captain update failed');

      // Error should appear before the driver picker in the DOM
      const errorPosition = errorElement.compareDocumentPosition(
        screen.getByTestId('driver-picker'),
      );
      expect(errorPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('Read-Only Mode', () => {
    it('displays owner name when readOnly is true', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={true}
        />,
      );

      expect(screen.getByText('Test Owner')).toBeInTheDocument();
    });

    it('does not display owner name when readOnly is false', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(screen.queryByText('Test Owner')).not.toBeInTheDocument();
    });

    it('passes readOnly=true to DriverPicker when in read-only mode', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={true}
        />,
      );

      expect(mockDriverPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
        }),
      );

      const driverPicker = screen.getByTestId('driver-picker');
      expect(driverPicker).toHaveAttribute('data-read-only', 'true');
    });

    it('passes readOnly=false to DriverPicker when not in read-only mode', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(mockDriverPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: false,
        }),
      );

      const driverPicker = screen.getByTestId('driver-picker');
      expect(driverPicker).toHaveAttribute('data-read-only', 'false');
    });

    it('passes readOnly=true to ConstructorPicker when in read-only mode', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={true}
        />,
      );

      expect(mockConstructorPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
        }),
      );

      const constructorPicker = screen.getByTestId('constructor-picker');
      expect(constructorPicker).toHaveAttribute('data-read-only', 'true');
    });

    it('passes readOnly=false to ConstructorPicker when not in read-only mode', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(mockConstructorPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: false,
        }),
      );

      const constructorPicker = screen.getByTestId('constructor-picker');
      expect(constructorPicker).toHaveAttribute('data-read-only', 'false');
    });
  });

  describe('Roster Lock', () => {
    const PAST_DEADLINE = '2026-02-01T12:00:00Z';
    const FUTURE_DEADLINE_DAYS = '2026-03-08T12:00:00Z'; // 12d away from 2026-02-24T12:00:00Z
    const FUTURE_DEADLINE_HOURS = '2026-02-24T15:30:00Z'; // 3h 30m away from 2026-02-24T12:00:00Z
    const FUTURE_DEADLINE_IMMINENT = '2026-02-24T12:00:30Z'; // 30s away from 2026-02-24T12:00:00Z

    const lockedRaces: Race[] = mockRaces.map((race) => ({
      ...race,
      lockDeadline: race.isCurrent ? PAST_DEADLINE : race.lockDeadline,
    }));

    const countdownRacesDays: Race[] = mockRaces.map((race) => ({
      ...race,
      lockDeadline: race.isCurrent ? FUTURE_DEADLINE_DAYS : race.lockDeadline,
    }));

    const countdownRacesHours: Race[] = mockRaces.map((race) => ({
      ...race,
      lockDeadline: race.isCurrent ? FUTURE_DEADLINE_HOURS : race.lockDeadline,
    }));

    const countdownRacesImminent: Race[] = mockRaces.map((race) => ({
      ...race,
      lockDeadline: race.isCurrent ? FUTURE_DEADLINE_IMMINENT : race.lockDeadline,
    }));

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "Lineup Locked" status when roster is locked', () => {
      vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={lockedRaces}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
    });

    it('shows compact countdown when more than 24h remain', () => {
      vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={countdownRacesDays}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Lineup Locks In')).toBeInTheDocument();
      expect(screen.getByText('12d 00h 00m')).toBeInTheDocument();
    });

    it('shows compact countdown when less than 24h remain', () => {
      vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={countdownRacesHours}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Lineup Locks In')).toBeInTheDocument();
      expect(screen.getByText('03h 30m')).toBeInTheDocument();
    });

    it('shows "Less than 1 minute" when lock is imminent', () => {
      vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={countdownRacesImminent}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Lineup Locks In')).toBeInTheDocument();
      expect(screen.getByText('Less than 1 minute')).toBeInTheDocument();
    });

    it('shows no lock status when lock deadline is null', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={mockRaces}
          readOnly={false}
        />,
      );

      expect(screen.queryByText('Lineup Locked')).not.toBeInTheDocument();
      expect(screen.queryByText('Lineup Locks In')).not.toBeInTheDocument();
    });

    it('passes readOnly=true to pickers when roster is locked', () => {
      vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          races={lockedRaces}
          readOnly={false}
        />,
      );

      expect(mockDriverPicker).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true }));
      expect(mockConstructorPicker).toHaveBeenCalledWith(
        expect.objectContaining({ readOnly: true }),
      );
    });
  });
});
