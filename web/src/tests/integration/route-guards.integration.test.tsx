import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildNoTeamLayout,
  buildStubRoute,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createMockTeam,
  createTeamContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Wiring tests for the production guard placement in `router.tsx`. Mirror only
// the layout chain — `_authenticated` (requireAuth) → `_team-required`
// (requireTeam) for /my-team, and `_no-team` (requireNoTeam) for /create-team.
// Destination routes are bare stubs so a redirect lands on something
// renderable; their headings are how each test confirms which redirect fired.
function buildGuardRouteTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
  });

  const landingRoute = buildStubRoute(rootRoute, { path: '/', heading: 'Landing Page' });
  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);
  const myTeamRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'my-team',
    heading: 'My Team Page',
  });
  const noTeamLayoutRoute = buildNoTeamLayout(rootRoute);
  const createTeamRoute = buildStubRoute(noTeamLayoutRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });
  const leaguesRoute = buildStubRoute(rootRoute, { path: 'leagues', heading: 'Leagues Page' });

  return rootRoute.addChildren([
    landingRoute,
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([myTeamRoute])]),
    noTeamLayoutRoute.addChildren([createTeamRoute]),
    leaguesRoute,
  ]);
}

describe('route guard wiring', () => {
  it('redirects unauthenticated users from /my-team to landing', async () => {
    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/my-team',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Landing Page' })).toBeInTheDocument();
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

  it('redirects authenticated users with a team from /create-team to /leagues', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())));

    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Leagues Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Team Page' })).not.toBeInTheDocument();
  });
});
