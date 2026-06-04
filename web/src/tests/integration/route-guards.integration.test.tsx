import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildNoTeamLayout,
  buildRootRoute,
  buildStubRoute,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createMockTeam,
  createTeamContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Wiring tests for the production guard placement in `router.tsx`. The root
// mirrors production's team-fetching `beforeLoad` (via `buildRootRoute`), so the
// `/me/team` MSW handler drives `context.team` through the real
// root → context → guard path the production tree uses. Mirror the layout chain:
// `_authenticated` (requireAuth) → `_team-required` (requireTeam) for /my-team,
// and `_authenticated` → `_no-team` (requireNoTeam) for /create-team. Destination
// routes are bare stubs so a redirect lands on something renderable; their
// headings are how each test confirms which redirect fired.
function buildGuardRouteTree(teamContextValue: TeamContextType) {
  const rootRoute = buildRootRoute({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
  });

  const homeRoute = buildStubRoute(rootRoute, { path: '/', heading: 'Home Page' });
  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);
  const myTeamRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'my-team',
    heading: 'My Team Page',
  });
  const noTeamLayoutRoute = buildNoTeamLayout(authenticatedLayoutRoute);
  const createTeamRoute = buildStubRoute(noTeamLayoutRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });

  return rootRoute.addChildren([
    homeRoute,
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([myTeamRoute]),
      noTeamLayoutRoute.addChildren([createTeamRoute]),
    ]),
  ]);
}

describe('route guard wiring', () => {
  it('redirects unauthenticated users from /my-team to /', async () => {
    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/my-team',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });

  it('redirects authenticated users without a team from /my-team to /create-team', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/my-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Create Team Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });

  it('redirects authenticated users with a team from /create-team to /', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())));

    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Team Page' })).not.toBeInTheDocument();
  });
});
