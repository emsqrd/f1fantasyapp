import { IndexRoute } from '@/components/IndexRoute/IndexRoute';
import type { RouterContext } from '@/lib/router-context';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { seasonQuery } from '@/services/seasonService';
import { getMyStandings } from '@/services/standingsService';
import { getTeamSummary } from '@/services/teamService';
import { API_BASE, server } from '@/setupTests';
import {
  createAuthedAuth,
  createBaseRouterContext,
  createMockUserProfile,
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

function buildIndexRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: async ({ context }) => {
      if (!context.auth.user) {
        return { home: null };
      }

      const season = await context.queryClient.ensureQueryData(seasonQuery);

      const [summary, standings, races] = await Promise.all([
        getTeamSummary(),
        getMyStandings(),
        season ? getRaceWeekends(season.id) : Promise.resolve([]),
      ]);

      return { home: { summary, standings, races } };
    },
    component: IndexRoute,
  });

  return rootRoute.addChildren([indexRoute]);
}

describe('routing at /', () => {
  it('renders the landing page for unauthenticated users', async () => {
    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: /Race to Glory/i }),
    ).toBeInTheDocument();
  });

  it('loads team summary, standings, and race weekends and renders Home for authed users', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: true })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({ teamName: 'Red Bull Racing', seasonTotalPoints: null, lastRace: null }),
      ),
      http.get(`${API_BASE}/me/standings`, () =>
        HttpResponse.json([
          { leagueId: 12, leagueName: 'Cota 2026', totalTeams: 8, position: 3, totalPoints: 184 },
        ]),
      ),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
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

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Monaco Grand Prix' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Open Cota 2026/i })).toBeInTheDocument();
  });

  it('renders the no-leagues prompt for authed users with a team but no standings', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: true })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({ teamName: 'Red Bull Racing', seasonTotalPoints: null, lastRace: null }),
      ),
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json([]),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByText("You're riding solo")).toBeInTheDocument();
  });

  it('renders Home for authed users with no team without crashing', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: false })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json([]),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /create team/i })).toBeInTheDocument();
  });

  it('keeps Home on the team variant when the profile fetch fails but the summary loads', async () => {
    // A transient profile failure must not demote a team-owner to the no-team Home:
    // existence is read from the team summary, not the profile.
    server.use(
      http.get(`${API_BASE}/me/profile`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({ teamName: 'Red Bull Racing', seasonTotalPoints: 312, lastRace: null }),
      ),
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json([]),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    // The team name still comes from the summary; the greeting name is just blank.
    expect(await screen.findByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
  });
});
