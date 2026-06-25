import { BrowseLeagues } from '@/components/BrowseLeagues/BrowseLeagues';
import { League } from '@/components/League/League';
import { LeagueList } from '@/components/LeagueList/LeagueList';
import { RouteErrorComponent } from '@/components/RouteErrorComponent/RouteErrorComponent';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { getAvailableLeagues, getLeagueById, leagueQueries } from '@/services/leagueService';
import { getLeagueStandings } from '@/services/standingsService';
import {
  buildAuthenticatedLayout,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createMockLeague,
  createMockLeagueStandings,
  createMockTeam,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
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
    errorComponent: RouteErrorComponent,
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
    errorComponent: RouteErrorComponent,
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([leagueRoute])]),
  ]);
}

function buildLeaguesListRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);

  const leaguesRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'leagues',
    loader: async ({ context }) => {
      await context.queryClient.ensureQueryData(leagueQueries.mine());
    },
    component: LeagueList,
    errorComponent: RouteErrorComponent,
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([leaguesRoute])]),
  ]);
}

function stubMyTeam(): void {
  // The League/BrowseLeagues pages read profile through the query (default
  // handler); the `/me/team` handler satisfies the `requireTeam` guard.
  server.use(http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())));
}

describe('Browse leagues', () => {
  it('renders league rows with name, description, badge, and member count', async () => {
    server.use(
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

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
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
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 1, name: 'Private League', isPrivate: true })]),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('button', { name: /join league/i })).toBeDisabled();
  });

  it('closes the confirmation dialog when cancel is clicked', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 1, name: 'Test League', isPrivate: false })]),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));
    expect(await screen.findByText('Join Test League?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('Join Test League?')).not.toBeInTheDocument();
  });

  it('scopes the confirmation dialog to the row whose join button was clicked', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([
          createMockLeague({ id: 1, name: 'League One', isPrivate: false }),
          createMockLeague({ id: 2, name: 'League Two', isPrivate: false }),
        ]),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
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
    server.use(http.get(`${API_BASE}/leagues/available`, () => HttpResponse.json([])));

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
    });

    expect(
      await screen.findByText('There are no available leagues to display'),
    ).toBeInTheDocument();
  });

  it('renders the route errorComponent when the loader fails', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/available`, () => new HttpResponse(null, { status: 500 })),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it('surfaces the API error message and closes the dialog when join fails with a server error', async () => {
    const user = userEvent.setup();

    server.use(
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

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));
    await user.click(await screen.findByRole('button', { name: /confirm join/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Already a member');
    expect(screen.queryByRole('button', { name: /confirm join/i })).not.toBeInTheDocument();
  });

  it('surfaces the apiClient fallback message when the network request itself fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/leagues/available`, () =>
        HttpResponse.json([createMockLeague({ id: 99, name: 'Open Grid', isPrivate: false })]),
      ),
      http.post(`${API_BASE}/leagues/99/join`, () => HttpResponse.error()),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildBrowseLeaguesRouteTree(),
      initialEntry: '/browse-leagues',
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));
    await user.click(await screen.findByRole('button', { name: /confirm join/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to join league');
  });
});

describe('My leagues', () => {
  it('renders the joined leagues from the loader as links to each league', async () => {
    server.use(
      http.get(`${API_BASE}/me/leagues`, () =>
        HttpResponse.json([
          createMockLeague({ id: 1, name: 'Apex Hunters' }),
          createMockLeague({ id: 2, name: 'Podium Chasers' }),
        ]),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeaguesListRouteTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('link', { name: /open apex hunters/i })).toHaveAttribute(
      'href',
      '/league/1',
    );
    expect(screen.getByRole('link', { name: /open podium chasers/i })).toHaveAttribute(
      'href',
      '/league/2',
    );
  });

  it('renders the empty state when no leagues have been joined', async () => {
    server.use(http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json([])));

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeaguesListRouteTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByText(/you haven't joined any leagues yet/i)).toBeInTheDocument();
  });

  it('creates a league with the form values', async () => {
    const user = userEvent.setup();
    let createBody: unknown;

    server.use(
      http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/leagues`, async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json(createMockLeague({ id: 7, name: 'Night Race Crew' }));
      }),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeaguesListRouteTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /create league/i }));
    await user.type(await screen.findByLabelText(/league name/i), '  Night Race Crew  ');
    await user.type(screen.getByLabelText(/description/i), '  Wheel to wheel  ');
    await user.click(screen.getByRole('switch', { name: /private/i }));
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(createBody).toEqual({
        name: 'Night Race Crew',
        description: 'Wheel to wheel',
        isPrivate: false,
      }),
    );
  });

  it('keeps the create dialog open and surfaces an error when the request fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/me/leagues`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/leagues`, () => new HttpResponse(null, { status: 500 })),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeaguesListRouteTree(),
      initialEntry: '/leagues',
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /create league/i }));
    await user.type(await screen.findByLabelText(/league name/i), 'Night Race Crew');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('League page', () => {
  it('renders league details returned by the loader', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/7`, () =>
        HttpResponse.json(createMockLeague({ id: 7, name: 'COTA Champions' })),
      ),
      http.get(`${API_BASE}/leagues/7/standings`, () =>
        HttpResponse.json(createMockLeagueStandings({ leagueId: 7 })),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: '/league/7',
      auth: createAuthedAuth(),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'COTA Champions' }),
    ).toBeInTheDocument();
  });

  it('renders the notFound component when the league does not exist', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/123`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/leagues/123/standings`, () =>
        HttpResponse.json(createMockLeagueStandings({ leagueId: 123 })),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: '/league/123',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('heading', { name: 'League Not Found' })).toBeInTheDocument();
  });

  it('renders the errorComponent when the loader fails with a server error', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/500`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/leagues/500/standings`, () =>
        HttpResponse.json(createMockLeagueStandings({ leagueId: 500 })),
      ),
    );

    stubMyTeam();
    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: '/league/500',
      auth: createAuthedAuth(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });
});
