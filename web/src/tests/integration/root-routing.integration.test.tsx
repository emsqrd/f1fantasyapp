import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import type { RouterContext } from '@/lib/router-context';
import {
  buildStubRoute,
  buildUnauthenticatedLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createTeamContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function buildRootRoutingTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
  });

  const unauthenticatedLayoutRoute = buildUnauthenticatedLayout(rootRoute);
  const indexRoute = buildStubRoute(unauthenticatedLayoutRoute, {
    path: '/',
    heading: 'Landing Page',
  });

  const createTeamRoute = buildStubRoute(rootRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });
  const leaguesRoute = buildStubRoute(rootRoute, {
    path: 'leagues',
    heading: 'Leagues Page',
  });

  return rootRoute.addChildren([
    unauthenticatedLayoutRoute.addChildren([indexRoute]),
    createTeamRoute,
    leaguesRoute,
  ]);
}

describe('routing at /', () => {
  it('leaves unauthenticated users at /', async () => {
    const teamContext = createTeamContext();
    renderWithRouter({
      routeTree: buildRootRoutingTree(teamContext),
      initialEntry: '/',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Landing Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Team Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Leagues Page' })).not.toBeInTheDocument();
  });

  it('redirects authenticated users without a team to /create-team', async () => {
    const teamContext = createTeamContext({ myTeamId: null, hasTeam: false });
    renderWithRouter({
      routeTree: buildRootRoutingTree(teamContext),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Create Team Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Landing Page' })).not.toBeInTheDocument();
  });

  it('redirects authenticated users with a team to /leagues', async () => {
    const teamContext = createTeamContext({ myTeamId: 1, hasTeam: true });
    renderWithRouter({
      routeTree: buildRootRoutingTree(teamContext),
      initialEntry: '/',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Leagues Page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Landing Page' })).not.toBeInTheDocument();
  });
});
