import { BrowseLeagues } from '@/components/BrowseLeagues/BrowseLeagues';
import { IndexRoute } from '@/components/IndexRoute/IndexRoute';
import { JoinInvite } from '@/components/JoinInvite/JoinInvite';
import { LeagueList } from '@/components/LeagueList/LeagueList';
import { RouteErrorComponent } from '@/components/RouteErrorComponent/RouteErrorComponent';
import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import { API_BASE, server } from '@/mocks';
import { previewInvite } from '@/services/leagueInviteService';
import { getAvailableLeagues, leagueQueries } from '@/services/leagueService';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { seasonQueries } from '@/services/seasonService';
import { standingsQueries } from '@/services/standingsService';
import { getTeamSummary } from '@/services/teamService';
import {
  buildAuthenticatedLayout,
  buildRootRoute,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createMockLeague,
  createMockTeam,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import { type AnyRoute, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// A new league enters my account three ways (create, join from Browse, join via
// invite) and surfaces in two places (the My Leagues page, the Home dashboard).
// Each write navigates to the league page, so the suite verifies the *other*
// surface reflects the change after returning to it — the user-observable
// behavior, independent of how the refresh is wired underneath.
//
// Load-bearing detail: each test seeds and caches the observed surface empty,
// then pins its query fresh (`setQueryDefaults(..., { staleTime })`). With the
// surface fresh, a revisit serves cache — so the league appears *only* if the
// write refreshed it. Without the pin the harness's stale-on-mount default would
// refetch regardless, and the test would pass even if the write skipped it.

const TOKEN = 'abc-token';

const CURRENT_SEASON = {
  id: 42,
  year: 2026,
  startDate: '2026-03-01',
  endDate: '2026-12-15',
  isCurrent: true,
};

function previewHandler() {
  return http.get(`${API_BASE}/leagues/join/${TOKEN}/preview`, () =>
    HttpResponse.json({
      leagueName: 'COTA Champions',
      leagueDescription: 'Battle for the lonestar cup',
      ownerName: 'Ada Lovelace',
      currentTeamCount: 5,
      maxTeams: 10,
      isLeagueFull: false,
    }),
  );
}

// A freshly joined league has no scored round yet, so position/totals are null
// (mirrors the API — see backend `GetMyStandings_LeagueWithoutScoredRound...`).
function standingFor(leagueId: number, leagueName: string): MyLeagueStanding {
  return { leagueId, leagueName, totalTeams: 2, position: null, totalPoints: null };
}

function stubMyTeam(): void {
  server.use(http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())));
}

// Everything the authed Home page reads except `/me/standings` — each Home test
// owns that handler since it's the surface under observation.
function stubHomeChrome(): void {
  server.use(
    http.get(`${API_BASE}/me/profile`, () =>
      HttpResponse.json(createMockUserProfile({ firstName: 'Ada', hasTeam: true })),
    ),
    http.get(`${API_BASE}/me/team/summary`, () =>
      HttpResponse.json({ teamName: 'Red Bull Racing', seasonTotalPoints: 312, lastRace: null }),
    ),
    http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(CURRENT_SEASON)),
    http.get(`${API_BASE}/seasons/${CURRENT_SEASON.id}/race-weekends`, () => HttpResponse.json([])),
  );
}

// Route pieces, mirroring `router.tsx`. Composed into per-test flow trees that
// pair a trigger page with the observed surface plus the `/league/$leagueId`
// landing every write navigates to.
function leaguesListRoute(parent: AnyRoute) {
  return createRoute({
    getParentRoute: () => parent,
    path: 'leagues',
    loader: async ({ context }) => {
      await context.queryClient.ensureQueryData(leagueQueries.mine());
    },
    component: LeagueList,
    errorComponent: RouteErrorComponent,
  });
}

function browseLeaguesRoute(parent: AnyRoute) {
  return createRoute({
    getParentRoute: () => parent,
    path: 'browse-leagues',
    loader: async () => ({ leagues: await getAvailableLeagues() }),
    component: BrowseLeagues,
    errorComponent: RouteErrorComponent,
  });
}

function leagueDetailStub(parent: AnyRoute) {
  return createRoute({
    getParentRoute: () => parent,
    path: 'league/$leagueId',
    component: () => <h1>League detail</h1>,
  });
}

function homeIndexRoute(root: AnyRoute) {
  return createRoute({
    getParentRoute: () => root,
    path: '/',
    loader: async ({ context }) => {
      if (!context.auth.user) {
        return { home: null };
      }
      const season = await context.queryClient.ensureQueryData(seasonQueries.current());
      const [summary, races] = await Promise.all([
        getTeamSummary(),
        season ? getRaceWeekends(season.id) : Promise.resolve([]),
      ]);
      return { home: { summary, races } };
    },
    component: IndexRoute,
    errorComponent: RouteErrorComponent,
  });
}

function joinInviteRoute(root: AnyRoute) {
  return createRoute({
    getParentRoute: () => root,
    path: '/join/$token',
    loader: async ({ params }) => ({ preview: await previewInvite(params.token) }),
    component: JoinInvite,
    errorComponent: RouteErrorComponent,
  });
}

function buildCreateToMyLeaguesTree() {
  const root = buildRootRoute();
  const auth = buildAuthenticatedLayout(root);
  const team = buildTeamRequiredLayout(auth);
  return root.addChildren([
    auth.addChildren([team.addChildren([leaguesListRoute(team), leagueDetailStub(team)])]),
  ]);
}

function buildBrowseToMyLeaguesTree() {
  const root = buildRootRoute();
  const auth = buildAuthenticatedLayout(root);
  const team = buildTeamRequiredLayout(auth);
  return root.addChildren([
    auth.addChildren([
      team.addChildren([leaguesListRoute(team), browseLeaguesRoute(team), leagueDetailStub(team)]),
    ]),
  ]);
}

function buildInviteToMyLeaguesTree() {
  const root = buildRootRoute();
  const auth = buildAuthenticatedLayout(root);
  const team = buildTeamRequiredLayout(auth);
  return root.addChildren([
    joinInviteRoute(root),
    auth.addChildren([team.addChildren([leaguesListRoute(team), leagueDetailStub(team)])]),
  ]);
}

function buildCreateToHomeTree() {
  const root = buildRootRoute();
  const auth = buildAuthenticatedLayout(root);
  const team = buildTeamRequiredLayout(auth);
  return root.addChildren([
    homeIndexRoute(root),
    auth.addChildren([team.addChildren([leaguesListRoute(team), leagueDetailStub(team)])]),
  ]);
}

function buildBrowseToHomeTree() {
  const root = buildRootRoute();
  const auth = buildAuthenticatedLayout(root);
  const team = buildTeamRequiredLayout(auth);
  return root.addChildren([
    homeIndexRoute(root),
    auth.addChildren([team.addChildren([browseLeaguesRoute(team), leagueDetailStub(team)])]),
  ]);
}

function buildInviteToHomeTree() {
  const root = buildRootRoute();
  const auth = buildAuthenticatedLayout(root);
  const team = buildTeamRequiredLayout(auth);
  return root.addChildren([
    homeIndexRoute(root),
    joinInviteRoute(root),
    auth.addChildren([team.addChildren([leagueDetailStub(team)])]),
  ]);
}

describe('My Leagues page reflects a newly added league', () => {
  it('shows a league created from the My Leagues page', async () => {
    const user = userEvent.setup();
    let myLeagues: ReturnType<typeof createMockLeague>[] = [];

    server.use(
      http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json(myLeagues)),
      http.post(`${API_BASE}/leagues`, () => {
        myLeagues = [createMockLeague({ id: 7, name: 'Night Race Crew' })];
        return HttpResponse.json(myLeagues[0]);
      }),
    );

    stubMyTeam();
    const { queryClient, router } = renderWithRouter({
      routeTree: buildCreateToMyLeaguesTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });
    queryClient.setQueryDefaults(leagueQueries.all, { staleTime: 60_000 });

    expect(await screen.findByText(/you haven't joined any leagues yet/i)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /create league/i }));
    await user.type(await screen.findByLabelText(/league name/i), 'Night Race Crew');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByRole('heading', { name: 'League detail' })).toBeInTheDocument();

    await router.navigate({ to: '/leagues' });
    expect(await screen.findByRole('link', { name: /open night race crew/i })).toBeInTheDocument();
  });

  it('shows a league joined from Browse', async () => {
    const user = userEvent.setup();
    let myLeagues: ReturnType<typeof createMockLeague>[] = [];

    server.use(
      http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json(myLeagues)),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 42, name: 'Apex Hunters', isPrivate: false })]),
      ),
      http.post(`${API_BASE}/leagues/42/join`, () => {
        myLeagues = [createMockLeague({ id: 42, name: 'Apex Hunters' })];
        return HttpResponse.json(myLeagues[0]);
      }),
    );

    stubMyTeam();
    const { queryClient, router } = renderWithRouter({
      routeTree: buildBrowseToMyLeaguesTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });
    queryClient.setQueryDefaults(leagueQueries.all, { staleTime: 60_000 });

    expect(await screen.findByText(/you haven't joined any leagues yet/i)).toBeInTheDocument();

    await router.navigate({ to: '/browse-leagues' });
    await user.click(await screen.findByRole('button', { name: /join league/i }));
    await user.click(await screen.findByRole('button', { name: /confirm join/i }));
    expect(await screen.findByRole('heading', { name: 'League detail' })).toBeInTheDocument();

    await router.navigate({ to: '/leagues' });
    expect(await screen.findByRole('link', { name: /open apex hunters/i })).toBeInTheDocument();
  });

  it('shows a league joined via invite', async () => {
    const user = userEvent.setup();
    let myLeagues: ReturnType<typeof createMockLeague>[] = [];

    server.use(
      http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json(myLeagues)),
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ hasTeam: true })),
      ),
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, () => {
        myLeagues = [createMockLeague({ id: 7, name: 'COTA Champions' })];
        return HttpResponse.json(myLeagues[0]);
      }),
    );

    stubMyTeam();
    const { queryClient, router } = renderWithRouter({
      routeTree: buildInviteToMyLeaguesTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });
    queryClient.setQueryDefaults(leagueQueries.all, { staleTime: 60_000 });

    expect(await screen.findByText(/you haven't joined any leagues yet/i)).toBeInTheDocument();

    await router.navigate({ to: '/join/$token', params: { token: TOKEN } });
    await user.click(await screen.findByRole('button', { name: /join league/i }));
    expect(await screen.findByRole('heading', { name: 'League detail' })).toBeInTheDocument();

    await router.navigate({ to: '/leagues' });
    expect(await screen.findByRole('link', { name: /open cota champions/i })).toBeInTheDocument();
  });
});

describe('Home dashboard reflects a newly added league', () => {
  it('shows a league created from the My Leagues page', async () => {
    const user = userEvent.setup();
    let myStandings: MyLeagueStanding[] = [];

    server.use(
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json(myStandings)),
      http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/leagues`, () => {
        myStandings = [standingFor(7, 'Night Race Crew')];
        return HttpResponse.json(createMockLeague({ id: 7, name: 'Night Race Crew' }));
      }),
    );

    stubMyTeam();
    stubHomeChrome();
    const { queryClient, router } = renderWithRouter({
      routeTree: buildCreateToHomeTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });
    queryClient.setQueryDefaults(standingsQueries.all, { staleTime: 60_000 });

    expect(await screen.findByText(/you're riding solo/i)).toBeInTheDocument();

    await router.navigate({ to: '/leagues' });
    await user.click(await screen.findByRole('button', { name: /create league/i }));
    await user.type(await screen.findByLabelText(/league name/i), 'Night Race Crew');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByRole('heading', { name: 'League detail' })).toBeInTheDocument();

    await router.navigate({ to: '/' });
    expect(await screen.findByRole('link', { name: /open night race crew/i })).toBeInTheDocument();
  });

  it('shows a league joined from Browse', async () => {
    const user = userEvent.setup();
    let myStandings: MyLeagueStanding[] = [];

    server.use(
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json(myStandings)),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 42, name: 'Apex Hunters', isPrivate: false })]),
      ),
      http.post(`${API_BASE}/leagues/42/join`, () => {
        myStandings = [standingFor(42, 'Apex Hunters')];
        return HttpResponse.json(createMockLeague({ id: 42, name: 'Apex Hunters' }));
      }),
    );

    stubMyTeam();
    stubHomeChrome();
    const { queryClient, router } = renderWithRouter({
      routeTree: buildBrowseToHomeTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });
    queryClient.setQueryDefaults(standingsQueries.all, { staleTime: 60_000 });

    expect(await screen.findByText(/you're riding solo/i)).toBeInTheDocument();

    await router.navigate({ to: '/browse-leagues' });
    await user.click(await screen.findByRole('button', { name: /join league/i }));
    await user.click(await screen.findByRole('button', { name: /confirm join/i }));
    expect(await screen.findByRole('heading', { name: 'League detail' })).toBeInTheDocument();

    await router.navigate({ to: '/' });
    expect(await screen.findByRole('link', { name: /open apex hunters/i })).toBeInTheDocument();
  });

  it('shows a league joined via invite', async () => {
    const user = userEvent.setup();
    let myStandings: MyLeagueStanding[] = [];

    server.use(
      http.get(`${API_BASE}/me/standings`, () => HttpResponse.json(myStandings)),
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, () => {
        myStandings = [standingFor(7, 'COTA Champions')];
        return HttpResponse.json(createMockLeague({ id: 7, name: 'COTA Champions' }));
      }),
    );

    stubMyTeam();
    stubHomeChrome();
    const { queryClient, router } = renderWithRouter({
      routeTree: buildInviteToHomeTree(),
      initialEntry: '/',
      auth: createAuthedAuth(),
    });
    queryClient.setQueryDefaults(standingsQueries.all, { staleTime: 60_000 });

    expect(await screen.findByText(/you're riding solo/i)).toBeInTheDocument();

    await router.navigate({ to: '/join/$token', params: { token: TOKEN } });
    await user.click(await screen.findByRole('button', { name: /join league/i }));
    expect(await screen.findByRole('heading', { name: 'League detail' })).toBeInTheDocument();

    await router.navigate({ to: '/' });
    expect(await screen.findByRole('link', { name: /open cota champions/i })).toBeInTheDocument();
  });
});
