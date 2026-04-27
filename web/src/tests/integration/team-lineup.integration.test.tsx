import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { MyTeamRoute, TeamRoute } from '@/components/Team/Team';
import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import type { Team } from '@/contracts/Team';
import { requireAuth, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { getConstructors } from '@/services/constructorService';
import { getDrivers } from '@/services/driverService';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { getMyTeam, getTeamById } from '@/services/teamService';
import { API_BASE, server } from '@/setupTests';
import {
  createMockConstructor,
  createMockDriver,
  createMockTeam,
  createMockTeamConstructor,
  createMockTeamDriver,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  notFound,
  redirect,
} from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

// Minimal route trees mirror the production `_authenticated → _team-required`
// chain in `router.tsx` so the real guards (`requireAuth`, `requireTeam`) and
// the real loaders run the same way they do in production. Loaders, components,
// and errorComponents are mirrored inline because the production routes aren't
// exported from `router.tsx`.
function buildMyTeamRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
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
    loader: async ({ context }) => {
      const seasonId = context.currentSeason?.id;
      const [team, activeDrivers, activeConstructors, races] = await Promise.all([
        getMyTeam(),
        getDrivers(),
        getConstructors(),
        seasonId !== undefined ? getRaceWeekends(seasonId) : Promise.resolve([]),
      ]);
      if (!team) throw redirect({ to: '/' });
      return { team, activeDrivers, activeConstructors, races };
    },
    component: MyTeamRoute,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([myTeamRoute])]),
  ]);
}

function buildTeamByIdRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
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

  const teamByIdRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'team/$teamId',
    loader: async ({ params, context }) => {
      const seasonId = context.currentSeason?.id;
      const teamId = Number(params.teamId);
      const [team, activeDrivers, activeConstructors, races] = await Promise.all([
        getTeamById(teamId),
        getDrivers(),
        getConstructors(),
        seasonId !== undefined ? getRaceWeekends(seasonId) : Promise.resolve([]),
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

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([teamByIdRoute])]),
  ]);
}

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
    myTeamId: 1,
    hasTeam: true,
    setMyTeamId: vi.fn(),
    refreshMyTeam: vi.fn(),
    ...overrides,
  };
}

const baseRouterContext: Omit<RouterContext, 'auth' | 'teamContext'> = {
  team: createMockTeam(),
  profile: createMockUserProfile(),
  currentSeason: {
    id: 1,
    year: 2026,
    startDate: '2026-03-01',
    endDate: '2026-12-01',
    isCurrent: true,
  },
};

const ferrari = createMockConstructor({ id: 10, name: 'Ferrari', price: 20_000_000 });
const mclaren = createMockConstructor({ id: 11, name: 'McLaren', price: 18_000_000 });
const redbull = createMockConstructor({ id: 12, name: 'Red Bull', price: 22_000_000 });
const allConstructors: Constructor[] = [ferrari, mclaren, redbull];

const verstappen = createMockDriver({
  id: 20,
  firstName: 'Max',
  lastName: 'Verstappen',
  abbreviation: 'VER',
  price: 30_000_000,
});
const norris = createMockDriver({
  id: 21,
  firstName: 'Lando',
  lastName: 'Norris',
  abbreviation: 'NOR',
  price: 25_000_000,
});
const piastri = createMockDriver({
  id: 22,
  firstName: 'Oscar',
  lastName: 'Piastri',
  abbreviation: 'PIA',
  price: 24_000_000,
});
const allDrivers: Driver[] = [verstappen, norris, piastri];

const futureRace: RaceWeekend = {
  id: 1,
  seasonId: 1,
  round: 5,
  name: 'Spanish Grand Prix',
  circuit: { id: 1, name: 'Circuit de Catalunya', location: 'Barcelona', country: 'Spain' },
  raceDate: '2030-06-01',
  lockDeadline: '2030-05-31T12:00:00Z',
  isCurrent: true,
  weekendFormat: 0,
};

const lockedRace: RaceWeekend = {
  ...futureRace,
  raceDate: '2020-06-01',
  lockDeadline: '2020-05-31T12:00:00Z',
};

function teamHandlers(team: Team) {
  return [
    http.get(`${API_BASE}/me/team`, () => HttpResponse.json(team)),
    http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
    http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
    http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([futureRace])),
  ];
}

describe('/my-team integration', () => {
  it('filters constructors already in lineup out of the picker pool', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({
      remainingBudget: 80_000_000,
      constructors: [createMockTeamConstructor({ ...ferrari, slotPosition: 0 })],
    });
    server.use(...teamHandlers(team));

    renderWithRouter({
      routeTree: buildMyTeamRouteTree(),
      initialEntry: '/my-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: makeTeamContext() },
    });

    await user.click(await screen.findByRole('button', { name: /add constructor/i }));

    const dialog = await screen.findByRole('dialog', { name: /select constructor/i });
    expect(within(dialog).queryByText('Ferrari')).not.toBeInTheDocument();
    expect(within(dialog).getByText('McLaren')).toBeInTheDocument();
    expect(within(dialog).getByText('Red Bull')).toBeInTheDocument();
  });

  it('filters drivers already in lineup out of the picker pool', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({
      remainingBudget: 80_000_000,
      drivers: [createMockTeamDriver({ ...verstappen, slotPosition: 0, isCaptain: false })],
    });
    server.use(...teamHandlers(team));

    renderWithRouter({
      routeTree: buildMyTeamRouteTree(),
      initialEntry: '/my-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: makeTeamContext() },
    });

    const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
    await user.click(addButtons[0]);

    const dialog = await screen.findByRole('dialog', { name: /select driver/i });
    expect(within(dialog).queryByText('Max Verstappen')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Lando Norris')).toBeInTheDocument();
    expect(within(dialog).getByText('Oscar Piastri')).toBeInTheDocument();
  });

  it('disables drivers whose price exceeds the remaining budget', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({ remainingBudget: 26_000_000, drivers: [] });
    server.use(...teamHandlers(team));

    renderWithRouter({
      routeTree: buildMyTeamRouteTree(),
      initialEntry: '/my-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: makeTeamContext() },
    });

    const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
    await user.click(addButtons[0]);

    const dialog = await screen.findByRole('dialog', { name: /select driver/i });

    // Max is $30M (over $26M budget) — disabled. Lando is $25M — enabled.
    const verstappenItem = within(dialog).getByText('Max Verstappen').closest('li')!;
    const norrisItem = within(dialog).getByText('Lando Norris').closest('li')!;
    expect(within(verstappenItem).getByRole('button', { name: /add driver/i })).toBeDisabled();
    expect(within(norrisItem).getByRole('button', { name: /add driver/i })).not.toBeDisabled();
  });

  it('disables pickers and shows "Lineup Locked" when lockDeadline has passed', async () => {
    const team = createMockTeam({
      remainingBudget: 80_000_000,
      drivers: [createMockTeamDriver({ ...verstappen, slotPosition: 0 })],
    });
    server.use(
      http.get(`${API_BASE}/me/team`, () => HttpResponse.json(team)),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([lockedRace])),
    );

    renderWithRouter({
      routeTree: buildMyTeamRouteTree(),
      initialEntry: '/my-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: makeTeamContext() },
    });

    expect(await screen.findByText('Lineup Locked')).toBeInTheDocument();

    // Filled slots show driver but no Remove button when locked.
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();

    // Empty slots collapse — no Add buttons render.
    expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
  });

  it('surfaces an error message when setCaptain fails', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({
      remainingBudget: 80_000_000,
      drivers: [createMockTeamDriver({ ...verstappen, slotPosition: 0, isCaptain: false })],
    });
    server.use(
      ...teamHandlers(team),
      http.put(`${API_BASE}/me/team/captain`, () => new HttpResponse(null, { status: 500 })),
    );

    renderWithRouter({
      routeTree: buildMyTeamRouteTree(),
      initialEntry: '/my-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: makeTeamContext() },
    });

    await user.click(await screen.findByRole('button', { name: /set .* as captain/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('/team/$teamId integration', () => {
  it("renders another user's team in readOnly mode without action buttons", async () => {
    const otherTeam = createMockTeam({
      id: 2,
      name: "Other User's Team",
      ownerName: 'Other User',
      remainingBudget: 80_000_000,
      drivers: [createMockTeamDriver({ ...verstappen, slotPosition: 0 })],
      constructors: [createMockTeamConstructor({ ...ferrari, slotPosition: 0 })],
    });

    server.use(
      // requireTeam guard — caller has their own team (id 1).
      http.get(`${API_BASE}/me/team`, () =>
        HttpResponse.json(createMockTeam({ id: 1, ownerName: 'Caller' })),
      ),
      http.get(`${API_BASE}/teams/2`, () => HttpResponse.json(otherTeam)),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([futureRace])),
    );

    renderWithRouter({
      routeTree: buildTeamByIdRouteTree(),
      initialEntry: '/team/2',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: makeTeamContext({ myTeamId: 1 }) },
    });

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
});
