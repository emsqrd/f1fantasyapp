import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { MyTeamRoute } from '@/components/Team/Team';
import type { Team } from '@/contracts/Team';
import type { RouterContext } from '@/lib/router-context';
import { getConstructors } from '@/services/constructorService';
import { getDrivers } from '@/services/driverService';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { seasonQuery } from '@/services/seasonService';
import { myTeamQuery } from '@/services/teamService';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createMockConstructorList,
  createMockDriverList,
  createMockRaceWeekend,
  createMockSeason,
  createMockTeam,
  createMockTeamConstructor,
  createMockTeamDriver,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Minimal route trees mirror the production `_authenticated → _team-required`
// chain in `router.tsx` so the real guards (`requireAuth`, `requireTeam`) and
// the real loaders run the same way they do in production. Loaders, components,
// and errorComponents are mirrored inline because the production routes aren't
// exported from `router.tsx`.
function buildMyTeamRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const teamRequiredLayoutRoute = buildTeamRequiredLayout(authenticatedLayoutRoute);

  const myTeamRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'my-team',
    loader: async ({ context }) => {
      const season = await context.queryClient.ensureQueryData(seasonQuery);
      await context.queryClient.ensureQueryData(myTeamQuery);
      const [activeDrivers, activeConstructors, races] = await Promise.all([
        getDrivers(),
        getConstructors(),
        season ? getRaceWeekends(season.id) : Promise.resolve([]),
      ]);
      return { activeDrivers, activeConstructors, races };
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

const allConstructors = createMockConstructorList([
  { name: 'Ferrari', price: 20_000_000 },
  { name: 'McLaren', price: 18_000_000 },
  { name: 'Red Bull', price: 22_000_000 },
]);

const allDrivers = createMockDriverList([
  { firstName: 'Max', lastName: 'Verstappen', price: 30_000_000 },
  { firstName: 'Lando', lastName: 'Norris', price: 25_000_000 },
  { firstName: 'Oscar', lastName: 'Piastri', price: 24_000_000 },
]);

const futureRace = createMockRaceWeekend();
const lockedRace = createMockRaceWeekend({
  raceDate: '2020-06-01',
  lockDeadline: '2020-05-31T12:00:00Z',
});

function teamHandlers(team: Team) {
  return [
    http.get(`${API_BASE}/me/team`, () => HttpResponse.json(team)),
    http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
    http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
    http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
    http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([futureRace])),
  ];
}

function renderMyTeam() {
  return renderWithRouter({
    routeTree: buildMyTeamRouteTree(),
    initialEntry: '/my-team',
    auth: createAuthedAuth(),
  });
}

describe('My team lineup', () => {
  it('filters constructors already in lineup out of the picker pool', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({
      remainingBudget: 80_000_000,
      constructors: [createMockTeamConstructor({ ...allConstructors[0], slotPosition: 0 })],
    });
    server.use(...teamHandlers(team));

    renderMyTeam();

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
      drivers: [createMockTeamDriver({ ...allDrivers[0], slotPosition: 0, isCaptain: false })],
    });
    server.use(...teamHandlers(team));

    renderMyTeam();

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

    renderMyTeam();

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
      drivers: [createMockTeamDriver({ ...allDrivers[0], slotPosition: 0 })],
    });
    server.use(
      http.get(`${API_BASE}/me/team`, () => HttpResponse.json(team)),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([lockedRace])),
    );

    renderMyTeam();

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
      drivers: [createMockTeamDriver({ ...allDrivers[0], slotPosition: 0, isCaptain: false })],
    });
    server.use(
      ...teamHandlers(team),
      http.put(`${API_BASE}/me/team/captain`, () => new HttpResponse(null, { status: 500 })),
    );

    renderMyTeam();

    await user.click(await screen.findByRole('button', { name: /set .* as captain/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
