import { MyTeamRoute } from '@/components/Team/Team';
import type { Team } from '@/contracts/Team';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { constructorsQuery } from '@/services/constructorService';
import { driversQuery } from '@/services/driverService';
import { getRaceWeekends } from '@/services/raceWeekendService';
import { seasonQuery } from '@/services/seasonService';
import { myTeamQuery } from '@/services/teamService';
import {
  buildAuthenticatedLayout,
  buildStubRoute,
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
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// Minimal route trees mirror the production `_authenticated → _team-required`
// chain in `router.tsx` so the real guards (`requireAuth`, `requireTeam`) and
// the real loaders run the same way they do in production. Loaders and
// components are mirrored inline because the production routes aren't
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
      const [races] = await Promise.all([
        season ? getRaceWeekends(season.id) : Promise.resolve([]),
        context.queryClient.ensureQueryData(driversQuery),
        context.queryClient.ensureQueryData(constructorsQuery),
      ]);
      return { races };
    },
    component: MyTeamRoute,
  });

  // A sibling under the same `_team-required` layout gives the captain-persistence
  // test somewhere to navigate so `MyTeamRoute` unmounts and remounts.
  const leaguesStubRoute = buildStubRoute(teamRequiredLayoutRoute, {
    path: 'leagues',
    heading: 'Leagues Page',
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([
      teamRequiredLayoutRoute.addChildren([myTeamRoute, leaguesStubRoute]),
    ]),
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

  it('refreshes the lineup after adding a driver', async () => {
    const user = userEvent.setup();
    const emptyTeam = createMockTeam({ remainingBudget: 80_000_000, drivers: [] });
    const teamWithDriver = createMockTeam({
      remainingBudget: 55_000_000,
      drivers: [createMockTeamDriver({ ...allDrivers[1], slotPosition: 0, isCaptain: false })],
    });

    let added = false;
    server.use(
      http.get(`${API_BASE}/me/team`, () => HttpResponse.json(added ? teamWithDriver : emptyTeam)),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([futureRace])),
      http.post(`${API_BASE}/me/team/drivers`, () => {
        added = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderMyTeam();

    const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
    await user.click(addButtons[0]);

    const dialog = await screen.findByRole('dialog', { name: /select driver/i });
    const norrisItem = within(dialog).getByText('Lando Norris').closest('li')!;
    await user.click(within(norrisItem).getByRole('button', { name: /add driver/i }));

    // The empty team renders no Remove controls; the added driver's slot only
    // fills once the invalidated query refetches the team-with-driver.
    expect(await screen.findByRole('button', { name: /remove driver/i })).toBeInTheDocument();
    expect(screen.getByText('Lando Norris')).toBeInTheDocument();
  });

  it('refreshes the lineup after removing a driver', async () => {
    const user = userEvent.setup();
    const teamWithDriver = createMockTeam({
      remainingBudget: 55_000_000,
      drivers: [createMockTeamDriver({ ...allDrivers[1], slotPosition: 0, isCaptain: false })],
    });
    const emptyTeam = createMockTeam({ remainingBudget: 80_000_000, drivers: [] });

    let removed = false;
    server.use(
      http.get(`${API_BASE}/me/team`, () =>
        HttpResponse.json(removed ? emptyTeam : teamWithDriver),
      ),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([futureRace])),
      http.delete(`${API_BASE}/me/team/drivers/0`, () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderMyTeam();

    await user.click(await screen.findByRole('button', { name: /remove driver/i }));

    // The driver only leaves the slot once the invalidated query refetches the
    // now-empty team.
    await waitFor(() => expect(screen.queryByText('Lando Norris')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
  });

  it('does not fire a second add while one is in flight', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({ remainingBudget: 80_000_000, drivers: [] });

    let resolveAdd!: () => void;
    let addCount = 0;
    server.use(
      ...teamHandlers(team),
      http.post(`${API_BASE}/me/team/drivers`, async () => {
        addCount++;
        await new Promise<void>((resolve) => {
          resolveAdd = resolve;
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderMyTeam();

    const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
    await user.click(addButtons[0]);

    const dialog = await screen.findByRole('dialog', { name: /select driver/i });
    const norrisItem = within(dialog).getByText('Lando Norris').closest('li')!;
    const addNorris = within(norrisItem).getByRole('button', { name: /add driver/i });

    // The first click leaves the add in flight (the handler holds the response),
    // so the picker stays open and isPending gates the second click.
    await user.click(addNorris);
    await user.click(addNorris);

    await waitFor(() => expect(addCount).toBe(1));

    resolveAdd();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /select driver/i })).not.toBeInTheDocument(),
    );
    expect(addCount).toBe(1);
  });

  it('keeps a newly set captain after navigating away and back', async () => {
    const user = userEvent.setup();
    const withoutCaptain = createMockTeam({
      remainingBudget: 55_000_000,
      drivers: [createMockTeamDriver({ ...allDrivers[0], slotPosition: 0, isCaptain: false })],
    });
    const withCaptain = createMockTeam({
      remainingBudget: 55_000_000,
      drivers: [createMockTeamDriver({ ...allDrivers[0], slotPosition: 0, isCaptain: true })],
    });

    let captainSet = false;
    server.use(
      http.get(`${API_BASE}/me/team`, () =>
        HttpResponse.json(captainSet ? withCaptain : withoutCaptain),
      ),
      http.get(`${API_BASE}/drivers`, () => HttpResponse.json(allDrivers)),
      http.get(`${API_BASE}/constructors`, () => HttpResponse.json(allConstructors)),
      http.get(`${API_BASE}/seasons/current`, () => HttpResponse.json(createMockSeason())),
      http.get(`${API_BASE}/seasons/1/race-weekends`, () => HttpResponse.json([futureRace])),
      http.put(`${API_BASE}/me/team/captain`, () => {
        captainSet = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { router } = renderMyTeam();

    await user.click(await screen.findByRole('button', { name: /set .* as captain/i }));
    await screen.findByRole('button', { name: /captain.*active/i });

    await act(async () => {
      await router.navigate({ to: '/leagues' });
    });
    await screen.findByRole('heading', { name: 'Leagues Page' });

    await act(async () => {
      await router.navigate({ to: '/my-team' });
    });

    // Before the fix the remounted view re-seeded from the stale cached team and
    // the captain reverted; the cache write now survives the unmount/remount.
    expect(await screen.findByRole('button', { name: /captain.*active/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the optimistic captain in flight, then surfaces an error when setCaptain fails', async () => {
    const user = userEvent.setup();
    const team = createMockTeam({
      remainingBudget: 80_000_000,
      drivers: [createMockTeamDriver({ ...allDrivers[0], slotPosition: 0, isCaptain: false })],
    });

    let respondCaptain!: () => void;
    server.use(
      ...teamHandlers(team),
      http.put(`${API_BASE}/me/team/captain`, async () => {
        await new Promise<void>((resolve) => {
          respondCaptain = resolve;
        });
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderMyTeam();

    // The PUT is held open, so only the optimistic cache patch can move the star here.
    await user.click(await screen.findByRole('button', { name: /set .* as captain/i }));
    expect(await screen.findByRole('button', { name: /captain.*active/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The revert below is observable but indistinguishable from the refetch that
    // runs after the request settles (which also serves a captain-less team); the
    // cache rollback on failure is pinned in useSetCaptain.test.ts.
    respondCaptain();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /set .* as captain/i })).toBeInTheDocument();
  });
});
