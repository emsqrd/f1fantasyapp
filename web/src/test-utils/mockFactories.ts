import type { League } from '@/contracts/League';
import type { Driver } from '@/contracts/Role';
import type { Team, TeamDriver } from '@/contracts/Team';

/**
 * Test utility: Creates a mock Driver with sensible defaults.
 *
 * @example
 * const driver = createMockDriver({ firstName: 'Max', lastName: 'Verstappen' });
 */
export function createMockDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    type: 'driver',
    id: 1,
    firstName: 'Test',
    lastName: 'Driver',
    countryAbbreviation: 'TST',
    ...overrides,
  };
}

/**
 * Test utility: Creates an array of mock drivers with auto-incrementing IDs.
 *
 * @example
 * const drivers = createMockDriverList(3);
 * // Creates: Driver 1, Driver 2, Driver 3
 *
 * @example
 * const drivers = createMockDriverList(2, (i) => ({
 *   firstName: 'Max',
 *   lastName: `Verstappen ${i}`
 * }));
 */
export function createMockDriverList(
  count: number,
  overridesFn?: (index: number) => Partial<Driver>,
): Driver[] {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    return createMockDriver({
      id: index,
      firstName: 'Driver',
      lastName: `${index}`,
      ...overridesFn?.(index),
    });
  });
}

/**
 * Test utility: Creates a mock TeamDriver with sensible defaults.
 *
 * @example
 * const driver = createMockTeamDriver({ firstName: 'Lewis', lastName: 'Hamilton' });
 */
export function createMockTeamDriver(overrides: Partial<TeamDriver> = {}): TeamDriver {
  return {
    slotPosition: 0,
    id: 1,
    firstName: 'Test',
    lastName: 'Driver',
    abbreviation: 'TDR',
    countryAbbreviation: 'TST',
    ...overrides,
  };
}

/**
 * Test utility: Creates an array of mock team drivers with auto-incrementing IDs and slot positions.
 *
 * @example
 * const drivers = createMockTeamDriverList(2);
 * // Creates 2 drivers with slotPosition 0 and 1
 *
 * @example
 * const drivers = createMockTeamDriverList(2, (i) => ({
 *   firstName: 'Lewis',
 *   lastName: i === 0 ? 'Hamilton' : 'Russell'
 * }));
 */
export function createMockTeamDriverList(
  count: number,
  overridesFn?: (index: number) => Partial<TeamDriver>,
): TeamDriver[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockTeamDriver({
      slotPosition: i,
      id: i + 1,
      ...overridesFn?.(i),
    });
  });
}

/**
 * Test utility: Creates a mock Team with sensible defaults.
 *
 * @example
 * // Basic usage
 * const team = createMockTeam();
 *
 * // With custom properties
 * const team = createMockTeam({ name: 'Red Bull Racing' });
 *
 * // With drivers
 * const team = createMockTeam({
 *   name: 'McLaren',
 *   drivers: [
 *     createMockTeamDriver({ firstName: 'Lando', lastName: 'Norris', slotPosition: 0 }),
 *     createMockTeamDriver({ firstName: 'Oscar', lastName: 'Piastri', slotPosition: 1 }),
 *   ]
 * });
 */
export function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 1,
    name: 'Test Team',
    ownerName: 'Test Owner',
    drivers: [],
    constructors: [],
    ...overrides,
  };
}

/**
 * Test utility: Creates an array of mock teams with auto-incrementing IDs.
 *
 * @example
 * const teams = createMockTeamList(3);
 * // Creates: Test Team 1, Test Team 2, Test Team 3
 *
 * @example
 * const teams = createMockTeamList(2, (i) => ({
 *   name: `Red Bull Racing ${i}`,
 *   drivers: createMockTeamDriverList(2)
 * }));
 */
export function createMockTeamList(
  count: number,
  overridesFn?: (index: number) => Partial<Team>,
): Team[] {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    return createMockTeam({
      id: index,
      name: `Test Team ${index}`,
      ownerName: `Test Owner ${index}`,
      ...overridesFn?.(index),
    });
  });
}

/**
 * Test utility: Creates a mock League with sensible defaults.
 *
 * @example
 * // Basic usage
 * const league = createMockLeague();
 *
 * // With custom properties
 * const league = createMockLeague({ name: 'COTA 2026' });
 *
 * // With teams
 * const league = createMockLeague({
 *    name: 'COTA 2026',
 *    teams: [
 *      createMockTeam({ id: 1, name: 'Test Team', ownerName: 'Test Owner' })
 *    ]
 * });
 */
export function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: 1,
    name: 'League 1',
    ownerName: 'Test Owner',
    description: 'Test Description',
    isPrivate: true,
    teams: createMockTeamList(1),
    ...overrides,
  };
}

/**
 * Creates an array of mock leagues with auto-incrementing IDs.
 *
 * @example
 * const leagues = createMockLeagueList(3);
 * // Creates: League 1, League 2, League 3
 *
 * @example
 * const leagues = createMockLeagueList(2, (i) => ({
 *   name: `Custom League ${i}`
 * }));
 */
export function createMockLeagueList(
  count: number,
  overridesFn?: (index: number) => Partial<League>,
): League[] {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    return createMockLeague({
      id: index,
      name: `League ${index}`,
      ...overridesFn?.(index),
    });
  });
}
