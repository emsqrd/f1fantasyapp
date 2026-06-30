import { IndexRoute } from '@/components/IndexRoute/IndexRoute';
import { RouteErrorComponent } from '@/components/RouteErrorComponent/RouteErrorComponent';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { raceWeekendQueries } from '@/services/raceWeekendService';
import { seasonQueries } from '@/services/seasonService';
import { teamQueries } from '@/services/teamService';
import {
  createAuthedAuth,
  createMockUserProfile,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

const CURRENT_SEASON = {
  id: 42,
  year: 2026,
  startDate: '2026-03-01',
  endDate: '2026-12-15',
  isCurrent: true,
};

const RACE_WEEKENDS = [
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
];

function buildIndexRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: async ({ context }) => {
      if (!context.auth.user) {
        return;
      }

      const season = await context.queryClient.ensureQueryData(seasonQueries.current());

      await Promise.all([
        context.queryClient.ensureQueryData(teamQueries.summary()),
        context.queryClient.ensureQueryData(raceWeekendQueries.list(season?.id ?? null)),
      ]);
    },
    component: IndexRoute,
    errorComponent: RouteErrorComponent,
  });

  return rootRoute.addChildren([indexRoute]);
}

describe('routing at /', () => {
  it('renders the landing page for unauthenticated users', async () => {
    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createUnauthAuth(),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: /Race to Glory/i }),
    ).toBeInTheDocument();
  });

  it('renders the team Home with the leagues list once standings load', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: true })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({
          teamName: 'Red Bull Racing',
          seasonTotalPoints: 312,
          lastRace: { round: 5, name: 'Bahrain Grand Prix', totalScore: 47 },
        }),
      ),
      http.get(`${API_BASE}/me/standings`, () =>
        HttpResponse.json([
          { leagueId: 12, leagueName: 'Cota 2026', totalTeams: 8, position: 3, totalPoints: 184 },
          {
            leagueId: 34,
            leagueName: 'Monaco Masters',
            totalTeams: 12,
            position: null,
            totalPoints: null,
          },
        ]),
      ),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json(RACE_WEEKENDS),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    expect(await screen.findByText('Welcome back, Ada')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Monaco Grand Prix' })).toBeInTheDocument();
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: /Open Cota 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Monaco Masters/i })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the no-leagues prompt for a team with no standings, header still present', async () => {
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
        HttpResponse.json(RACE_WEEKENDS),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByText("You're riding solo")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
  });

  it('degrades only the leagues widget when standings fail', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: true })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({ teamName: 'Red Bull Racing', seasonTotalPoints: 312, lastRace: null }),
      ),
      http.get(`${API_BASE}/me/standings`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json(RACE_WEEKENDS),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Monaco Grand Prix' })).toBeInTheDocument();
    expect(screen.getByText('Season stats')).toBeInTheDocument();
    expect(screen.getByText('Last race stats')).toBeInTheDocument();

    expect(await screen.findByText(/We couldn't load your leagues/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('recovers the leagues widget when the retry is clicked', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: true })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () =>
        HttpResponse.json({
          teamName: 'Red Bull Racing',
          seasonTotalPoints: 312,
          lastRace: null,
        }),
      ),
      http.get(`${API_BASE}/me/standings`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json(RACE_WEEKENDS),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });

    const retry = await screen.findByRole('button', { name: /try again/i });

    server.use(
      http.get(`${API_BASE}/me/standings`, () =>
        HttpResponse.json([
          { leagueId: 12, leagueName: 'Cota 2026', totalTeams: 8, position: 3, totalPoints: 184 },
        ]),
      ),
    );

    await user.click(retry);

    expect(await screen.findByRole('link', { name: /Open Cota 2026/i })).toBeInTheDocument();
  });

  it('fails the route when the team summary fetch fails', async () => {
    server.use(
      http.get(`${API_BASE}/me/team/summary`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json(RACE_WEEKENDS),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Red Bull Racing' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: /Race to Glory/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
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
    });

    // The team name still comes from the summary; the greeting name is just blank.
    expect(await screen.findByRole('heading', { name: 'Red Bull Racing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
  });

  it('renders the no-team Home without ever fetching standings', async () => {
    // No `/me/standings` handler: the no-team branch must not mount the leagues
    // widget, so a request here would fail under strict-mode MSW.
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: false })),
      ),
      http.get(`${API_BASE}/me/team/summary`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
      http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () =>
        HttpResponse.json([]),
      ),
    );

    renderWithRouter({
      routeTree: buildIndexRouteTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /create team/i })).toBeInTheDocument();
  });
});
