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
  createMockDriver,
  createMockLeague,
  createMockLeagueList,
  createMockLeagueStandings,
  createMockTeam,
  createMockTeamConstructor,
  createMockTeamDriver,
  createMockUserProfile,
} from './mockFactories';
export {
  createAuthedAuth,
  createBaseRouterContext,
  createTeamContext,
  createUnauthAuth,
} from './renderContexts';
export { renderWithRouter } from './renderWithRouter';
export type { RenderWithRouterOptions } from './renderWithRouter';
export {
  buildAuthenticatedLayout,
  buildNoTeamLayout,
  buildStubRoute,
  buildTeamRequiredLayout,
} from './routeTreeBuilders';
