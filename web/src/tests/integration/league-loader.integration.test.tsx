import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { League } from '@/components/League/League';
import type { RouterContext } from '@/lib/router-context';
import { getLeagueById } from '@/services/leagueService';
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
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Mirrors the production `leagueRoute` loader at `router.tsx`. Kept inline
// because the production route's parent is fixed at definition time and can't
// be re-parented for tests. Updates to the loader's behavior need to be
// reflected here too — these tests exist precisely to pin that behavior.
const leagueIdParamsSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
});

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
      const ROUTE_ID = '/_authenticated/_team-required/league/$leagueId';
      const validation = leagueIdParamsSchema.safeParse(params);
      if (!validation.success) {
        throw notFound({ routeId: ROUTE_ID });
      }
      const { leagueId } = validation.data;
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

function renderLeagueRoute() {
  renderWithRouter({
    routeTree: buildLeagueRouteTree(),
    initialEntry: '/league/1',
    auth: createAuthedAuth(),
    routerContext: createBaseRouterContext({ team: createMockTeam() }),
  });
}

describe('League route loader', () => {
  it('renders not-found when the league lookup returns 404', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/1`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/leagues/1/standings`, () =>
        HttpResponse.json(createMockLeagueStandings()),
      ),
    );

    renderLeagueRoute();

    expect(await screen.findByRole('heading', { name: /league not found/i })).toBeInTheDocument();
  });

  it('renders not-found when the standings lookup returns 404', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/1`, () => HttpResponse.json(createMockLeague())),
      http.get(`${API_BASE}/leagues/1/standings`, () => new HttpResponse(null, { status: 404 })),
    );

    renderLeagueRoute();

    expect(await screen.findByRole('heading', { name: /league not found/i })).toBeInTheDocument();
  });

  it('renders the league page when both endpoints succeed', async () => {
    server.use(
      http.get(`${API_BASE}/leagues/1`, () =>
        HttpResponse.json(createMockLeague({ name: 'Test League' })),
      ),
      http.get(`${API_BASE}/leagues/1/standings`, () =>
        HttpResponse.json(createMockLeagueStandings()),
      ),
    );

    renderLeagueRoute();

    expect(await screen.findByRole('heading', { name: 'Test League' })).toBeInTheDocument();
  });
});
