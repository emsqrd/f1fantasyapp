import { JoinInvite } from '@/components/JoinInvite/JoinInvite';
import { RouteErrorComponent } from '@/components/RouteErrorComponent/RouteErrorComponent';
import type { Team } from '@/contracts/Team';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { previewInvite } from '@/services/leagueInviteService';
import { standingsKeys } from '@/services/standingsService';
import {
  createAuthedAuth,
  createMockLeague,
  createMockTeam,
  createMockUserProfile,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { isApiError } from '@/utils/errors';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  notFound,
} from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';

// `/join/$token` is a public top-level route — not under `_authenticated`. The
// integration tree mirrors `joinInviteRoute` from `router.tsx` plus minimal
// stub routes for the destinations the rendered Link components target: the
// JoinInvite actions (`/sign-in`, `/sign-up`, `/create-team`) and the "Go home"
// escape on the not-found and error fallbacks (`/`). Stubs are bare placeholders
// — the component bodies never render in these tests; they exist so TanStack
// Router can resolve the `to` props and produce their hrefs (the auth links
// carry the redirect query string).
function buildJoinInviteRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
    notFoundComponent: () => <h1>404 - Page Not Found</h1>,
  });

  const joinInviteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/join/$token',
    component: JoinInvite,
    loader: async ({ params }) => {
      try {
        const preview = await previewInvite(params.token);
        return { preview };
      } catch (error) {
        if (isApiError(error) && error.status === 400) {
          throw notFound({ routeId: '/join/$token' });
        }
        throw error;
      }
    },
    errorComponent: RouteErrorComponent,
    notFoundComponent: () => (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="mb-4 text-4xl font-bold">Invite Not Found</h1>
        <p className="text-muted-foreground mb-4">
          This invite link isn't valid. Double-check the link, or ask the league owner to share it
          again.
        </p>
        <Link to="/" className="text-primary hover:underline">
          Go home
        </Link>
      </div>
    ),
  });

  // `validateSearch` is required for `<Link search={{ redirect }}>` to serialize
  // the param into the rendered href; the rest is intentionally bare.
  const redirectSearch = (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  });

  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-in',
    validateSearch: redirectSearch,
    component: () => null,
  });

  const signUpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-up',
    validateSearch: redirectSearch,
    component: () => null,
  });

  const createTeamRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/create-team',
    validateSearch: redirectSearch,
    component: () => null,
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  });

  // A successful join navigates here.
  const leagueRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/league/$leagueId',
    component: () => null,
  });

  return rootRoute.addChildren([
    indexRoute,
    joinInviteRoute,
    signInRoute,
    signUpRoute,
    createTeamRoute,
    leagueRoute,
  ]);
}

// JoinInvite reads team existence from `profile.hasTeam` (fetched via the profile
// query on the authed branches), not from context — so seed the profile here and
// keep the `team` arg as the test's has-team intent. Unauthenticated renders
// never fetch it, so the handler is harmless there.
function stubProfileForTeam(team: Team | null): void {
  server.use(
    http.get(`${API_BASE}/me/profile`, () =>
      HttpResponse.json(createMockUserProfile({ hasTeam: team !== null })),
    ),
  );
}

const TOKEN = 'abc-token';

function previewHandler(overrides: Partial<Record<string, unknown>> = {}) {
  return http.get(`${API_BASE}/leagues/join/${TOKEN}/preview`, () =>
    HttpResponse.json({
      leagueName: 'COTA Champions',
      leagueDescription: 'Battle for the lonestar cup',
      ownerName: 'Ada Lovelace',
      currentTeamCount: 5,
      maxTeams: 10,
      isLeagueFull: false,
      ...overrides,
    }),
  );
}

describe('Join via invite token', () => {
  it('shows sign-in and create-account links carrying a redirect back to the invite for unauthenticated users', async () => {
    server.use(previewHandler());

    stubProfileForTeam(null);
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createUnauthAuth(),
    });

    const signInLink = await screen.findByRole('link', { name: /sign in to join/i });
    const createAccountLink = screen.getByRole('link', { name: /create account/i });

    expect(signInLink.getAttribute('href')).toContain('/sign-in');
    expect(signInLink.getAttribute('href')).toContain(
      `redirect=${encodeURIComponent(`/join/${TOKEN}`)}`,
    );
    expect(createAccountLink.getAttribute('href')).toContain('/sign-up');
    expect(createAccountLink.getAttribute('href')).toContain(
      `redirect=${encodeURIComponent(`/join/${TOKEN}`)}`,
    );

    expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
  });

  it('shows a create-team link carrying a redirect back to the invite for authed users without a team', async () => {
    server.use(previewHandler());

    stubProfileForTeam(null);
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    const createTeamLink = await screen.findByRole('link', { name: /create team/i });
    expect(createTeamLink.getAttribute('href')).toContain('/create-team');
    expect(createTeamLink.getAttribute('href')).toContain(
      `redirect=${encodeURIComponent(`/join/${TOKEN}`)}`,
    );

    expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).not.toBeInTheDocument();
  });

  it('shows the join-league button for authed users with a team', async () => {
    server.use(previewHandler());

    stubProfileForTeam(createMockTeam());
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('button', { name: /join league/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).not.toBeInTheDocument();
  });

  it('invalidates the cached standings after joining via invite', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, () =>
        HttpResponse.json(createMockLeague({ id: 7, name: 'COTA Champions' })),
      ),
    );

    stubProfileForTeam(createMockTeam());
    const { queryClient } = renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    // A cached standings entry is required for the invalidation to be observable.
    queryClient.setQueryData(standingsKeys.all, []);

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    await waitFor(() =>
      expect(queryClient.getQueryState(standingsKeys.all)?.isInvalidated).toBe(true),
    );
  });

  it('renders the invite-not-found page when the loader rejects with a 400 (unknown token)', async () => {
    server.use(
      http.get(
        `${API_BASE}/leagues/join/${TOKEN}/preview`,
        () => new HttpResponse(null, { status: 400 }),
      ),
    );

    stubProfileForTeam(null);
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createUnauthAuth(),
    });

    expect(await screen.findByRole('heading', { name: /invite not found/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /404 - page not found/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the error card, not a not-found page, when the preview fails with a 500', async () => {
    server.use(
      http.get(
        `${API_BASE}/leagues/join/${TOKEN}/preview`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    stubProfileForTeam(null);
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createUnauthAuth(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /invite not found/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /404 - page not found/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the league-full alert and hides action buttons when preview reports the league is full', async () => {
    server.use(previewHandler({ isLeagueFull: true }));

    stubProfileForTeam(createMockTeam());
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This league is full and cannot accept new members.',
    );
    expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).not.toBeInTheDocument();
  });

  it('surfaces an inline error and stays on the invite page when the join request fails', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      http.post(
        `${API_BASE}/leagues/join/${TOKEN}`,
        () =>
          new HttpResponse(JSON.stringify({ detail: 'Server is on fire' }), {
            status: 500,
            headers: { 'content-type': 'application/problem+json' },
          }),
      ),
    );

    stubProfileForTeam(createMockTeam());
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server is on fire');
    // Still on the invite page: the join button is rebound after `isJoining` resets.
    expect(screen.getByRole('button', { name: /join league/i })).toBeInTheDocument();
  });

  it('surfaces "Failed to join league" when the join request returns an empty body', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      // 204 makes apiClient resolve to null, which the component treats as failure.
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, () => new HttpResponse(null, { status: 204 })),
    );

    stubProfileForTeam(createMockTeam());
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to join league');
  });

  it('clears the previous error when the user retries the join', async () => {
    const user = userEvent.setup();

    let attempts = 0;
    server.use(
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, async () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(JSON.stringify({ detail: 'first error' }), {
            status: 500,
            headers: { 'content-type': 'application/problem+json' },
          });
        }
        // Hang so the second attempt stays in-flight while we observe the
        // pre-await `setError(null)` clearing the previous alert.
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    stubProfileForTeam(createMockTeam());
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    const joinButton = await screen.findByRole('button', { name: /join league/i });
    await user.click(joinButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('first error');

    await user.click(screen.getByRole('button', { name: /join league/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('shows a "Joining..." loading state while the join request is in flight', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    stubProfileForTeam(createMockTeam());
    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(),
      initialEntry: `/join/${TOKEN}`,
      auth: createAuthedAuth(),
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    expect(await screen.findByRole('button', { name: /joining/i })).toBeInTheDocument();
  });
});
