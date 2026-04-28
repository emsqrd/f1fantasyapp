import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import { requireAuth, requireNoTeam, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/setupTests';
import { createMockTeam, renderWithRouter } from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

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

  const landingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <h1>Landing Page</h1>,
  });

  const authenticatedLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: ({ context }) => requireAuth(context),
    component: () => <Outlet />,
  });

  const teamRequiredLayoutRoute = createRoute({
    getParentRoute: () => authenticatedLayoutRoute,
    id: '_team-required',
    beforeLoad: ({ context }) => requireTeam(context),
    component: () => <Outlet />,
  });

  const myTeamRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'my-team',
    component: () => <h1>My Team Page</h1>,
  });

  const noTeamLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_no-team',
    beforeLoad: ({ context }) => requireNoTeam(context),
    component: () => <Outlet />,
  });

  const createTeamRoute = createRoute({
    getParentRoute: () => noTeamLayoutRoute,
    path: 'create-team',
    component: () => <h1>Create Team Page</h1>,
  });

  const leaguesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'leagues',
    component: () => <h1>Leagues Page</h1>,
  });

  return rootRoute.addChildren([
    landingRoute,
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([myTeamRoute])]),
    noTeamLayoutRoute.addChildren([createTeamRoute]),
    leaguesRoute,
  ]);
}

const unauthAuth: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  isAuthTransitioning: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  startAuthTransition: vi.fn(),
  completeAuthTransition: vi.fn(),
};

const authedAuth: AuthContextType = {
  user: { id: 'user-123' } as User,
  session: {} as Session,
  loading: false,
  isAuthTransitioning: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  startAuthTransition: vi.fn(),
  completeAuthTransition: vi.fn(),
};

function makeTeamContext(overrides: Partial<TeamContextType> = {}): TeamContextType {
  return {
    myTeamId: null,
    hasTeam: false,
    setMyTeamId: vi.fn(),
    refreshMyTeam: vi.fn(),
    ...overrides,
  };
}

const baseRouterContext: Omit<RouterContext, 'auth' | 'teamContext'> = {
  team: null,
  profile: null,
  currentSeason: null,
};

describe('route guard wiring', () => {
  it('redirects unauthenticated users from /my-team to landing', async () => {
    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/my-team',
      auth: unauthAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    expect(await screen.findByRole('heading', { name: 'Landing Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });

  it('redirects authenticated users without a team from /my-team to /create-team', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/my-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    expect(await screen.findByRole('heading', { name: 'Create Team Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Team Page' })).not.toBeInTheDocument();
  });

  it('redirects authenticated users with a team from /create-team to /leagues', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())));

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildGuardRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    expect(await screen.findByRole('heading', { name: 'Leagues Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Team Page' })).not.toBeInTheDocument();
  });
});
