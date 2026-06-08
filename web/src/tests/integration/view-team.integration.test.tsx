import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { TeamRoute } from '@/components/Team/Team';
import type { RouterContext } from '@/lib/router-context';
import { getConstructors } from '@/services/constructorService';
import { getDrivers } from '@/services/driverService';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { seasonQuery } from '@/services/seasonService';
import { getTeamById } from '@/services/teamService';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildStubRoute,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createMockConstructorList,
  createMockDriverList,
  createMockRaceWeekend,
  createMockSeason,
  createMockTeam,
  createMockTeamConstructor,
  createMockTeamDriver,
  renderWithRouter,
} from '@/tests/test-utils';
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  notFound,
  redirect,
} from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Minimal route tree mirrors the production `_authenticated → _team-required`
// chain in `router.tsx` so the real guards (`requireAuth`, `requireTeam`) and
// the route's own `beforeLoad`/loader run the same way they do in production.
// The route is mirrored inline because it isn't exported from `router.tsx`; the
// `/my-team` stub is the self-redirect target.
function buildTeamByIdRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);

  const teamByIdRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'team/$teamId',
    beforeLoad: ({ context, params }) => {
      const teamId = Number(params.teamId);
      if (Number.isInteger(teamId) && context.team?.id === teamId) {
        throw redirect({ to: '/my-team', replace: true });
      }
    },
    loader: async ({ params, context }) => {
      const season = await context.queryClient.ensureQueryData(seasonQuery);
      const teamId = Number(params.teamId);
      const [team, activeDrivers, activeConstructors, races] = await Promise.all([
        getTeamById(teamId),
        getDrivers(),
        getConstructors(),
        season ? getRaceWeekends(season.id) : Promise.resolve([]),
      ]);
      if (!team) {
        throw notFound({ routeId: '/_authenticated/_team-required/team/$teamId' });
      }
      return { team, activeDrivers, activeConstructors, races };
    },
    component: TeamRoute,
    notFoundComponent: () => <h1>Team Not Found</h1>,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  const myTeamStubRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'my-team',
    heading: 'My Team Page',
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([teamByIdRoute, myTeamStubRoute]),
    ]),
  ]);
}

function renderTeamById(initialEntry: string) {
  return renderWithRouter({
    routeTree: buildTeamByIdRouteTree(),
    initialEntry,
    auth: createAuthedAuth(),
    routerContext: createBaseRouterContext({
      team: createMockTeam(),
    }),
  });
}

describe('Viewing a team', () => {
  it("renders another user's team in readOnly mode without action buttons", async () => {
    const otherTeam = createMockTeam({
      id: 2,
      name: "Other User's Team",
      ownerName: 'Other User',
      remainingBudget: 80_000_000,
      drivers: [
        createMockTeamDriver({ firstName: 'Max', lastName: 'Verstappen', slotPosition: 0 }),
      ],
      constructors: [createMockTeamConstructor({ name: 'Ferrari', slotPosition: 0 })],
    });

    server.use(
      http.get(`${API_BASE}/teams/2`, () => HttpResponse.json(otherTeam)),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(createMockDriverList(2))),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(createMockConstructorList(2))),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () =>
        HttpResponse.json([createMockRaceWeekend()]),
      ),
    );

    renderTeamById('/team/2');

    expect(await screen.findByRole('heading', { name: "Other User's Team" })).toBeInTheDocument();
    expect(screen.getByText('Other User')).toBeInTheDocument();
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.getByText('Ferrari')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove constructor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /captain/i })).not.toBeInTheDocument();
  });

  it('redirects to /my-team when viewing your own team', async () => {
    renderTeamById('/team/1');

    expect(await screen.findByRole('heading', { name: 'My Team Page' })).toBeInTheDocument();
  });
});
