import { BrowseLeagues } from '@/components/BrowseLeagues/BrowseLeagues';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { League } from '@/components/League/League';
import type { RouterContext } from '@/lib/router-context';
import { getAvailableLeagues, getLeagueById } from '@/services/leagueService';
import { getLeagueStandings } from '@/services/standingsService';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createMockLeague,
  createMockLeagueStandings,
  createMockTeam,
  createMockUserProfile,
  createTeamContext,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Minimal route trees mirror the production `_authenticated → _team-required`
// chain in `router.tsx` so the real guards (`requireAuth`, `requireTeam`) and
// the real loaders run the same way they do in production. Loaders, components,
// and errorComponents are mirrored inline because the production routes aren't
// exported from `router.tsx`.
function buildBrowseLeaguesRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);

  const browseLeaguesRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'browse-leagues',
    loader: async () => ({ leagues: await getAvailableLeagues() }),
    component: BrowseLeagues,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([browseLeaguesRoute]),
    ]),
  ]);
}

function buildLeagueRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);

  const leagueRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'league/$leagueId',
    loader: async ({ params }) => {
      const leagueId = Number(params.leagueId);
      const ROUTE_ID = '/_authenticated/_team-required/league/$leagueId';
      const [league, standings] = await Promise.all([
        getLeagueById(leagueId),
        getLeagueStandings(leagueId),
      ]);
      if (!league || !standings) {
        throw notFound({ routeId: ROUTE_ID });
      }
      return { league, standings };
    },
    component: League,
    notFoundComponent: () => <h1>League Not Found</h1>,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([leagueRoute])]),
  ]);
}

function authedRouterContext(): Omit<RouterContext, 'auth'> {
  return createBaseRouterContext({
    teamContext: createTeamContext({ myTeamId: 1, hasTeam: true }),
    team: createMockTeam(),
    profile: createMockUserProfile(),
  });
}

// Handler the `requireTeam` guard needs to find a team for the authed user.
function teamHandler() {
  return http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam()));
}

describe('Browse leagues', () => {
  it('renders league rows with name, description, badge, and member count', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([
          createMockLeague({
            id: 1,
            name: 'Open Grid',
            description: 'Best league ever',
            isPrivate: false,
            teamCount: 5,
            maxTeams: 10,
          }),
          createMockLeague({
            id: 2,
            name: 'Pit Wall',
            description: 'Invite only',
            isPrivate: true,
            teamCount: 3,
            maxTeams: 8,
          }),
        ]),
      ),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Open Grid' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pit Wall' })).toBeInTheDocument();
    expect(screen.getByText('Best league ever')).toBeInTheDocument();
    expect(screen.getByText('Invite only')).toBeInTheDocument();
    expect(screen.getByText('5 / 10 members')).toBeInTheDocument();
    expect(screen.getByText('3 / 8 members')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();

    // Container exposes its purpose to assistive tech.
    expect(screen.getByLabelText('Available leagues')).toBeInTheDocument();
  });

  it('disables the join button for private leagues', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 1, name: 'Private League', isPrivate: true })]),
      ),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(await screen.findByRole('button', { name: /join league/i })).toBeDisabled();
  });

  it('closes the confirmation dialog when cancel is clicked', async () => {
    const user = userEvent.setup();

    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 1, name: 'Test League', isPrivate: false })]),
      ),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));
    expect(await screen.findByText('Join Test League?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('Join Test League?')).not.toBeInTheDocument();
  });

  it('scopes the confirmation dialog to the row whose join button was clicked', async () => {
    const user = userEvent.setup();

    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([
          createMockLeague({ id: 1, name: 'League One', isPrivate: false }),
          createMockLeague({ id: 2, name: 'League Two', isPrivate: false }),
        ]),
      ),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    const joinButtons = await screen.findAllByRole('button', { name: /join league/i });

    await user.click(joinButtons[0]);
    expect(await screen.findByText('Join League One?')).toBeInTheDocument();
    expect(screen.queryByText('Join League Two?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(joinButtons[1]);

    expect(await screen.findByText('Join League Two?')).toBeInTheDocument();
    expect(screen.queryByText('Join League One?')).not.toBeInTheDocument();
  });

  it('renders the empty state when no leagues are available', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () => HttpResponse.json([])),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(
      await screen.findByText('There are no available leagues to display'),
    ).toBeInTheDocument();
  });

  it('renders the route errorComponent when the loader fails', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () => new HttpResponse(null, { status: 500 })),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it('surfaces the API error message and closes the dialog when join fails with a server error', async () => {
    const user = userEvent.setup();

    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 42, name: 'Open Grid', isPrivate: false })]),
      ),
      http.post(
        `${API_BASE}/leagues/42/join`,
        () =>
          new HttpResponse(JSON.stringify({ detail: 'Already a member' }), {
            status: 409,
            headers: { 'content-type': 'application/problem+json' },
          }),
      ),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));
    await user.click(await screen.findByRole('button', { name: /confirm join/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Already a member');
    expect(screen.queryByRole('button', { name: /confirm join/i })).not.toBeInTheDocument();
  });

  it('surfaces the apiClient fallback message when the network request itself fails', async () => {
    const user = userEvent.setup();

    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 99, name: 'Open Grid', isPrivate: false })]),
      ),
      http.post(`${API_BASE}/leagues/99/join`, () => HttpResponse.error()),
    );

    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));
    await user.click(await screen.findByRole('button', { name: /confirm join/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to join league');
  });
});

describe('League page', () => {
  it('renders league details returned by the loader', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/7`, () =>
        HttpResponse.json(createMockLeague({ id: 7, name: 'COTA Champions' })),
      ),
      http.get(`${API_BASE}/leagues/7/standings`, () =>
        HttpResponse.json(createMockLeagueStandings({ leagueId: 7 })),
      ),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: '/league/7',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'COTA Champions' }),
    ).toBeInTheDocument();
  });

  it('renders the notFound component when the league does not exist', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/123`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/leagues/123/standings`, () =>
        HttpResponse.json(createMockLeagueStandings({ leagueId: 123 })),
      ),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: '/league/123',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'League Not Found' })).toBeInTheDocument();
  });

  it('renders the errorComponent when the loader fails with a server error', async () => {
    server.use(
      teamHandler(),
      http.get(`${API_BASE}/leagues/500`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/leagues/500/standings`, () =>
        HttpResponse.json(createMockLeagueStandings({ leagueId: 500 })),
      ),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: '/league/500',
      auth: createAuthedAuth(),
      routerContext: authedRouterContext(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });
});
