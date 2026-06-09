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
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Wiring tests for the production guard placement in `router.tsx`. The root
// mirrors production's team-fetching `beforeLoad` (via `buildRootRoute`), so the
// `/me/team` MSW handler drives `context.team` through the real
// root → context → guard path the production tree uses. Mirror the layout chain:
// `_authenticated` (requireAuth) → `_team-required` (requireTeam) for /my-team,
// with `/create-team` sitting directly under `_authenticated` as the no-team
// redirect target. Destination routes are bare stubs so a redirect lands on
// something renderable; their headings are how each test confirms which redirect
// fired.
function buildGuardRouteTree() {
  const rootRoute = buildRootRoute();

  const homeRoute = buildStubRoute(rootRoute, { path: '/', heading: 'Home Page' });
  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);
  const myTeamRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'my-team',
    heading: 'My Team Page',
  });
  const createTeamRoute = buildStubRoute(authenticatedLayoutRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });

  return rootRoute.addChildren([
    homeRoute,
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([myTeamRoute]),
      createTeamRoute,
    ]),
  ]);
}

describe('route guard wiring', () => {
  it('redirects unauthenticated users from /my-team to /', async () => {
    renderWithRouter({
      routeTree: buildGuardRouteTree(),
      initialEntry: '/my-team',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
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
