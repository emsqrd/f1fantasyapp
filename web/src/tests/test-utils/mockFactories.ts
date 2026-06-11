import type { League } from '@/contracts/League';
import type { LeagueStandings } from '@/contracts/LeagueStandings';
import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import type { Season } from '@/contracts/Season';
import type { Team, TeamConstructor, TeamDriver } from '@/contracts/Team';
import type { UserProfile } from '@/contracts/UserProfile';

/**
 * Test utility: Creates a mock Driver with sensible defaults.
 *
 * @example
 * const driver = createMockDriver({ firstName: 'Max', lastName: 'Verstappen' });
 */
export function createMockDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 1,
    firstName: 'Test',
    lastName: 'Driver',
    abbreviation: 'TDS',
    countryAbbreviation: 'TST',
    price: 1_000_000,
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
 * const drivers = createMockDriverList([
 *   { firstName: 'Max', lastName: 'Verstappen' },
 *   { firstName: 'Lewis', lastName: 'Hamilton' },
 * ]);
 */
export function createMockDriverList(countOrOverrides: number | Partial<Driver>[]): Driver[] {
  const items = Array.isArray(countOrOverrides)
    ? countOrOverrides
    : Array.from({ length: countOrOverrides }, () => ({}));

  return items.map((overrides, i) => {
    const index = i + 1;
    return createMockDriver({
      id: index,
      firstName: 'Driver',
      lastName: `${index}`,
      abbreviation: `DS${index}`,
      countryAbbreviation: 'DST',
      ...overrides,
    });
  });
}

/**
 * Test utility: Creates a mock Constructor with sensible defaults.
 *
 * @example
 * const constructor = createMockConstructor({ name: 'Red Bull Racing', fullName: 'Oracle Red Bull Racing' });
 */
export function createMockConstructor(overrides: Partial<Constructor> = {}): Constructor {
  return {
    id: 1,
    name: 'Test',
    fullName: 'Test Constructor',
    abbreviation: 'TST',
    countryAbbreviation: 'TST',
    price: 1_000_000,
    ...overrides,
  };
}

/**
 * Test utility: Creates an array of mock constructors with auto-incrementing IDs.
 *
 * @example
 * const constructors = createMockConstructorList(3);
 * // Creates: Constructor 1, Constructor 2, Constructor 3
 *
 * @example
 * const constructors = createMockConstructorList([
 *   { name: 'McLaren', fullName: 'McLaren F1 Team' },
 *   { name: 'Ferrari', fullName: 'Scuderia Ferrari' },
 * ]);
 */
export function createMockConstructorList(
  countOrOverrides: number | Partial<Constructor>[],
): Constructor[] {
  const items = Array.isArray(countOrOverrides)
    ? countOrOverrides
    : Array.from({ length: countOrOverrides }, () => ({}));

  return items.map((overrides, i) => {
    const index = i + 1;
    return createMockConstructor({
      id: index,
      name: `Constructor ${index}`,
      abbreviation: `CS${index}`,
      fullName: `Constructor ${index}`,
      countryAbbreviation: 'TST',
      ...overrides,
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
    price: 1_000_000,
    isCaptain: false,
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
 * Test utility: Creates a mock TeamConstructor with sensible defaults.
 *
 * @example
 * const constructor = createMockTeamConstructor({ name: 'Ferrari', fullName: 'Scuderia Ferrari' });
 */
export function createMockTeamConstructor(
  overrides: Partial<TeamConstructor> = {},
): TeamConstructor {
  return {
    slotPosition: 0,
    id: 1,
    name: 'Test',
    abbreviation: 'TS',
    fullName: 'Test Constructor',
    countryAbbreviation: 'TST',
    price: 1_000_000,
    ...overrides,
  };
}

/**
 * Test utility: Creates an array of mock team constructors with auto-incrementing IDs and slot positions.
 *
 * @example
 * const constructors = createMockTeamConstructorList(2);
 * // Creates 2 constructors with slotPosition 0 and 1
 *
 * @example
 * const constructors = createMockTeamConstructorList(2, (i) => ({
 *   name: i === 0 ? 'Ferrari' : 'McLaren',
 *   fullName: i === 0 ? 'Scuderia Ferrari' : 'McLaren F1 Team'
 * }));
 */
export function createMockTeamConstructorList(
  count: number,
  overridesFn?: (index: number) => Partial<TeamConstructor>,
): TeamConstructor[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockTeamConstructor({
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
    ownerId: 1,
    ownerName: 'Test Owner',
    remainingBudget: 100_000_000,
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
    ownerId: 1,
    description: 'Test Description',
    isPrivate: true,
    teamCount: 1,
    maxTeams: 10,
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

/**
 * Test utility: Creates a mock LeagueStandings response with sensible defaults.
 *
 * @example
 * // Empty standings (preseason / no scoring yet)
 * const standings = createMockLeagueStandings();
 *
 * @example
 * // Mid-season
 * const standings = createMockLeagueStandings({
 *   lastScoredRound: 7,
 *   lastScoredRaceWeekendName: 'Miami GP',
 *   standings: [...],
 * });
 */
export function createMockLeagueStandings(
  overrides: Partial<LeagueStandings> = {},
): LeagueStandings {
  return {
    leagueId: 1,
    lastScoredRound: null,
    lastScoredRaceWeekendName: null,
    standings: [],
    ...overrides,
  };
}

/**
 * Test utility: Creates a mock UserProfile with sensible defaults.
 *
 * @example
 * const profile = createMockUserProfile({ displayName: 'Ada Lovelace' });
 */
export function createMockUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 1,
    email: 'test.user@example.com',
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    avatarUrl: '',
    hasTeam: false,
    ...overrides,
  };
}

/**
 * Test utility: Creates a mock Season with sensible defaults (the current season).
 *
 * @example
 * const season = createMockSeason({ year: 2025, isCurrent: false });
 */
export function createMockSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 1,
    year: 2026,
    startDate: '2026-03-01',
    endDate: '2026-12-01',
    isCurrent: true,
    ...overrides,
  };
}

/**
 * Test utility: Creates a mock RaceWeekend with sensible defaults (a current,
 * not-yet-locked weekend). Pass past `raceDate`/`lockDeadline` for a locked one.
 *
 * @example
 * const locked = createMockRaceWeekend({ raceDate: '2020-06-01', lockDeadline: '2020-05-31T12:00:00Z' });
 */
export function createMockRaceWeekend(overrides: Partial<RaceWeekend> = {}): RaceWeekend {
  return {
    id: 1,
    seasonId: 1,
    round: 5,
    name: 'Spanish Grand Prix',
    circuit: { id: 1, name: 'Circuit de Catalunya', location: 'Barcelona', country: 'Spain' },
    raceDate: '2030-06-01',
    lockDeadline: '2030-05-31T12:00:00Z',
    isCurrent: true,
    weekendFormat: 0,
    ...overrides,
  };
}
