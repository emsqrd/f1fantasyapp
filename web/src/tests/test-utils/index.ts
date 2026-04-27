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
  createMockTeam,
  createMockTeamConstructor,
  createMockTeamDriver,
  createMockUserProfile,
} from './mockFactories';
export { renderWithRouter } from './renderWithRouter';
export type { RenderWithRouterOptions } from './renderWithRouter';
