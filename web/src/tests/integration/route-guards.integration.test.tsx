import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { requireAuth, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildRootRoute,
  buildStubRoute,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Wiring tests for the production guard placement in `router.tsx`. The root
// mirrors production's team-fetching `beforeLoad` (via `buildRootRoute`), so the
// `/me/team` MSW handler drives `context.team` through the real
// root → context → guard path the production tree uses. Mirror the layout chain:
// `_authenticated` (requireAuth) → `_team-required` (requireTeam) for /my-team,
// with `/create-team` sitting directly under `_authenticated` as the no-team
// redirect target. `/sign-in` sits at the root as the unauthenticated redirect
// target. Destination routes are bare stubs so a redirect lands on something
// renderable; their headings are how each test confirms which redirect fired.
function buildGuardRouteTree() {
  const rootRoute = buildRootRoute();

  const signInRoute = buildStubRoute(rootRoute, { path: '/sign-in', heading: 'Sign In Page' });
  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);
  const myTeamRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'my-team',
    heading: 'My Team Page',
  });
  const leagueRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'league/$leagueId',
    heading: 'League Page',
  });
  const createTeamRoute = buildStubRoute(authenticatedLayoutRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });

  return rootRoute.addChildren([
    signInRoute,
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([myTeamRoute, leagueRoute]),
      createTeamRoute,
    ]),
  ]);
}

describe('route guard wiring', () => {
  it('redirects an unauthenticated visitor to /sign-in carrying the attempted path', async () => {
    const { router } = renderWithRouter({
      routeTree: buildGuardRouteTree(),
      initialEntry: '/my-team',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect((router.state.location.search as { redirect?: string }).redirect).toBe('/my-team');
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });

  it('round-trips a deep link query string through the redirect param', async () => {
    const { router } = renderWithRouter({
      routeTree: buildGuardRouteTree(),
      initialEntry: '/league/5?tab=roster',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument();
    expect((router.state.location.search as { redirect?: string }).redirect).toBe(
      '/league/5?tab=roster',
    );
  });

  it('redirects authenticated users without a team from /my-team to /create-team', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    renderWithRouter({
      routeTree: buildGuardRouteTree(),
      initialEntry: '/my-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Create Team Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });
});

// The `_authenticated` layout carries an errorComponent in production; mirror it
// here. A transient `/me/team` failure makes `requireTeam` throw, and that throw
// must surface in this boundary (with a retry) rather than be misread as
// "no team" and redirect to /create-team. The boundary sits on `_authenticated`,
// not `_team-required`, because a route's own errorComponent doesn't reliably
// catch its own beforeLoad throw on a hard load.
function buildTeamErrorRouteTree() {
  const rootRoute = buildRootRoute();

  const authenticatedLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: ({ context }: { context: RouterContext }) => requireAuth(context),
    component: () => <Outlet />,
    errorComponent: ({ error, reset }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} onReset={reset} level="page" />
      </ErrorBoundary>
    ),
  });

  const teamRequiredLayoutRoute = createRoute({
    getParentRoute: () => authenticatedLayoutRoute,
    id: '_team-required',
    beforeLoad: ({ context }: { context: RouterContext }) => requireTeam(context),
    component: () => <Outlet />,
  });

  const myTeamRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'my-team',
    heading: 'My Team Page',
  });
  const createTeamRoute = buildStubRoute(authenticatedLayoutRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([myTeamRoute]),
      createTeamRoute,
    ]),
  ]);
}

describe('team-required error surface', () => {
  it('surfaces a transient team-fetch failure in the authenticated error boundary, not /create-team', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 500 })));

    renderWithRouter({
      routeTree: buildTeamErrorRouteTree(),
      initialEntry: '/my-team',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Team Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });
});
