import { IndexRoute } from '@/components/IndexRoute/IndexRoute';
import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import type { RouterContext } from '@/lib/router-context';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { getMyStandings } from '@/services/standingsService';
import { getTeamSummary } from '@/services/teamService';
import { API_BASE, server } from '@/setupTests';
import {
  createAuthedAuth,
  createBaseRouterContext,
  createMockTeam,
  createMockUserProfile,
  createTeamContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

const CURRENT_SEASON = {
  id: 42,
  year: 2026,
  startDate: '2026-03-01',
  endDate: '2026-12-15',
  isCurrent: true,
};

function buildIndexRouteTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: async ({ context }) => {
      if (!context.auth.user) {
        return { home: null };
      }

      const [summary, standings, races] = await Promise.all([
        getTeamSummary(),
        getMyStandings(),
        context.currentSeason ? getRaceWeekends(context.currentSeason.id) : Promise.resolve([]),
      ]);

      return { home: { summary, standings, races } };
    },
    component: IndexRoute,
  });

  return rootRoute.addChildren([indexRoute]);
}

describe('routing at /', () => {
  it('renders the landing page for unauthenticated users', async () => {
    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildIndexRouteTree(teamContext),
      initialEntry: '/',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: /Race to Glory/i }),
    ).toBeInTheDocument();
  });

  it('loads team summary, standings, and race weekends and renders Home for authed users', async () => {
    server.use(
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({ seasonTotalPoints: null, lastRace: null }),
      ),
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json([
          {
            id: 7,
            seasonId: CURRENT_SEASON.id,
            round: 7,
            name: 'Monaco Grand Prix',
            circuit: {
              id: 1,
              name: 'Circuit de Monaco',
              location: 'Monte Carlo',
              country: 'Monaco',
            },
            raceDate: '2026-05-31',
            lockDeadline: '2099-01-01T00:00:00Z',
            isCurrent: true,
            weekendFormat: 0,
          },
        ]),
      ),
    );

    const teamContext = createTeamContext({ myTeamId: 1, hasTeam: true });
    renderWithRouter({
      routeTree: buildIndexRouteTree(teamContext),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({
        teamContext,
        profile: createMockUserProfile({ firstName: 'Ada' }),
        team: createMockTeam({ name: 'Red Bull Racing' }),
        currentSeason: CURRENT_SEASON,
      }),
    });

    expect(await screen.findByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Monaco Grand Prix' })).toBeInTheDocument();
  });

  it('renders Home for authed users with no team without crashing', async () => {
    server.use(
      http.get(`${API_BASE}/me/team/summary`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json([]),
      ),
    );

    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildIndexRouteTree(teamContext),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({
        teamContext,
        profile: createMockUserProfile({ firstName: 'Ada' }),
        team: null,
        currentSeason: CURRENT_SEASON,
      }),
    });

    expect(await screen.findByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /create team/i })).toBeInTheDocument();
  });
});
