/**
 * Test Utilities
 *
 * Centralized test helpers, mock factories, and utilities.
 * Import from '@/tests/test-utils' for cleaner test files.
 *
 * @example
 * import { createMockTeam, createMockDriver } from '@/tests/test-utils';
 */

export {
  createMockConstructor,
  createMockConstructorList,
  createMockDriver,
  createMockDriverList,
  createMockLeague,
  createMockLeagueList,
  createMockLeagueStandings,
  createMockRaceWeekend,
  createMockSeason,
  createMockTeam,
  createMockTeamConstructor,
  createMockTeamDriver,
  createMockUserProfile,
} from './mockFactories';
export { createAuthedAuth, createBaseRouterContext, createUnauthAuth } from './renderContexts';
export { renderWithRouter } from './renderWithRouter';
export type { RenderWithRouterOptions } from './renderWithRouter';
export {
  buildAuthenticatedLayout,
  buildRootRoute,
  buildStubRoute,
  buildTeamRequiredLayout,
  buildUnauthenticatedLayout,
} from './routeTreeBuilders';
