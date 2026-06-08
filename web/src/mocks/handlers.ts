import { createMockSeason, createMockUserProfile } from '@/tests/test-utils/mockFactories';
import { HttpResponse, http } from 'msw';

/**
 * Base URL the test suite's apiClient targets. Defined here rather than in
 * setupTests so the default handlers can build full URLs without importing back
 * through setupTests (a cycle); re-exported from setupTests for existing imports.
 */
export const API_BASE = 'http://localhost/api';

/**
 * Default MSW handlers seeded into the test server. Profile/team/season are read
 * through the Query cache, so nearly every authenticated tree touches these
 * endpoints; seeding sane defaults keeps each flow test from re-declaring the
 * common surface. Tests override per-flow with `server.use(...)`.
 *
 * Defaults model a freshly-authenticated user without a team yet: a profile with
 * `hasTeam: false`, no `/me/team`, and the current season.
 */
export const handlers = [
  http.get(`${API_BASE}/me/profile`, () => HttpResponse.json(createMockUserProfile())),
  http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
  http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
];
