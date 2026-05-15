import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import type { RouterContext } from '@/lib/router-context';
import {
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
  createTeamContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import {
  ErrorComponent,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  redirect,
} from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .refine((url) => url.startsWith('/'), 'Redirect must be an internal path')
    .optional()
    .catch(undefined),
});

function buildRootRoutingTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: redirectSearchSchema,
    component: () => <h1>Landing Page</h1>,
    beforeLoad: async ({ context }) => {
      if (context.auth.user) {
        throw redirect({
          to: context.teamContext.hasTeam ? '/leagues' : '/create-team',
          replace: true,
        });
      }
    },
    errorComponent: ({ error }) => <ErrorComponent error={error} />,
  });

  const createTeamRoute = buildStubRoute(rootRoute, {
    path: 'create-team',
    heading: 'Create Team Page',
  });
  const leaguesRoute = buildStubRoute(rootRoute, {
    path: 'leagues',
    heading: 'Leagues Page',
  });

  return rootRoute.addChildren([indexRoute, createTeamRoute, leaguesRoute]);
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
