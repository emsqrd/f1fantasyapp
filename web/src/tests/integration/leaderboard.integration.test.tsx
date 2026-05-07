import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { League } from '@/components/League/League';
import { SessionType } from '@/contracts/LeagueStandings';
import type { LeagueStandings, StandingsEntry } from '@/contracts/LeagueStandings';
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
  createMockUserProfile,
  createTeamContext,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

const VIEWER_ID = 42;

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
      const [league, standings] = await Promise.all([
        getLeagueById(Number(params.leagueId)),
        getLeagueStandings(Number(params.leagueId)),
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

function renderLeaguePage(standings: LeagueStandings) {
  server.use(
    http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())),
    http.get(`${API_BASE}/leagues/1`, () =>
      HttpResponse.json(
        createMockLeague({ id: 1, name: 'Pit Wall', description: 'A test league' }),
      ),
    ),
    http.get(`${API_BASE}/leagues/1/standings`, () => HttpResponse.json(standings)),
  );

  renderWithRouter({
    routeTree: buildLeagueRouteTree(),
    initialEntry: '/league/1',
    auth: createAuthedAuth(),
    routerContext: createBaseRouterContext({
      teamContext: createTeamContext({ myTeamId: 1, hasTeam: true }),
      profile: createMockUserProfile({ id: VIEWER_ID }),
    }),
  });
}

function buildEntry(overrides: Partial<StandingsEntry> = {}): StandingsEntry {
  return {
    teamId: 1,
    teamName: 'Test Team',
    ownerId: 1,
    ownerName: 'Test Owner',
    position: 1,
    totalPoints: 100,
    positionChange: 0,
    ...overrides,
  };
}

describe('Leaderboard page', () => {
  it('renders the empty-state card when there are no standings entries', async () => {
    renderLeaguePage(createMockLeagueStandings({ standings: [] }));

    expect(await screen.findByText('No teams in this league yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Leaderboard' })).not.toBeInTheDocument();
  });

  it('renders one row per standings entry with team name, owner, points, and delta glyphs', async () => {
    renderLeaguePage(
      createMockLeagueStandings({
        currentRound: 7,
        afterRaceWeekendName: 'Miami Grand Prix',
        afterSessionType: SessionType.GrandPrix,
        standings: [
          buildEntry({
            teamId: 10,
            teamName: 'Lightning McQueen',
            ownerId: 1,
            ownerName: 'Sally',
            position: 1,
            totalPoints: 1234,
            positionChange: 2,
          }),
          buildEntry({
            teamId: 11,
            teamName: 'Banana Boat',
            ownerId: 2,
            ownerName: 'Mater',
            position: 2,
            totalPoints: 999,
            positionChange: -1,
          }),
          buildEntry({
            teamId: 12,
            teamName: 'Status Quo',
            ownerId: 3,
            ownerName: 'Doc',
            position: 3,
            totalPoints: 500,
            positionChange: 0,
          }),
          buildEntry({
            teamId: 13,
            teamName: 'New Entry',
            ownerId: 4,
            ownerName: 'Newcomer',
            position: 4,
            totalPoints: 250,
            positionChange: null,
          }),
        ],
      }),
    );

    const list = await screen.findByRole('list', { name: 'Leaderboard' });
    expect(list).toBeInTheDocument();

    expect(within(list).getByText('Lightning McQueen')).toBeInTheDocument();
    expect(within(list).getByText('Sally')).toBeInTheDocument();
    expect(within(list).getByText('1,234')).toBeInTheDocument();
    expect(within(list).getByText('999')).toBeInTheDocument();
    expect(within(list).getByText('500')).toBeInTheDocument();
    expect(within(list).getByText('250')).toBeInTheDocument();

    // Up / down deltas — the labels are duplicated (mobile-inline + desktop-column),
    // but they share the same accessible name. `getAllByLabelText` returns both.
    expect(within(list).getAllByLabelText('Up 2 positions').length).toBeGreaterThan(0);
    expect(within(list).getAllByLabelText('Down 1 positions').length).toBeGreaterThan(0);
    expect(within(list).getAllByLabelText('No position change').length).toBeGreaterThan(0);
  });

  it('marks the viewer\'s row with "your team" in the accessible name', async () => {
    renderLeaguePage(
      createMockLeagueStandings({
        standings: [
          buildEntry({ teamId: 10, ownerId: 1, position: 1, teamName: 'Other Team' }),
          buildEntry({ teamId: 11, ownerId: VIEWER_ID, position: 2, teamName: 'My Team' }),
          buildEntry({ teamId: 12, ownerId: 3, position: 3, teamName: 'Another Team' }),
        ],
      }),
    );

    expect(
      await screen.findByRole('link', { name: /Open My Team, your team, position 2/ }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /^Open Other Team, position 1$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Other Team.*your team/ })).not.toBeInTheDocument();
  });

  it("routes the viewer's row to /my-team and other rows to /team/$teamId", async () => {
    renderLeaguePage(
      createMockLeagueStandings({
        standings: [
          buildEntry({ teamId: 10, ownerId: 1, position: 1, teamName: 'Other Team' }),
          buildEntry({ teamId: 11, ownerId: VIEWER_ID, position: 2, teamName: 'My Team' }),
        ],
      }),
    );

    const myLink = await screen.findByRole('link', { name: /Open My Team, your team/ });
    expect(myLink).toHaveAttribute('href', '/my-team');

    const otherLink = screen.getByRole('link', { name: /Open Other Team/ });
    expect(otherLink).toHaveAttribute('href', '/team/10');
  });

  describe('header chip conditioning', () => {
    it('renders both chips when currentRound and afterRaceWeekendName are set', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: 7,
          totalRounds: 24,
          afterRaceWeekendName: 'Miami Grand Prix',
          afterSessionType: SessionType.Sprint,
          standings: [buildEntry()],
        }),
      );

      expect(await screen.findByText(/Round 7/)).toBeInTheDocument();
      expect(screen.getByText(/Miami Grand Prix/)).toBeInTheDocument();
    });

    it('renders only the Round chip when afterRaceWeekendName is null', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: 1,
          totalRounds: 24,
          afterRaceWeekendName: null,
          afterSessionType: null,
          standings: [buildEntry()],
        }),
      );

      expect(await screen.findByText(/Round 1/)).toBeInTheDocument();
      expect(screen.queryByText(/After/)).not.toBeInTheDocument();
    });

    it('renders only the After chip when currentRound is null (post-finale)', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: null,
          totalRounds: 24,
          afterRaceWeekendName: 'Abu Dhabi Grand Prix',
          afterSessionType: SessionType.GrandPrix,
          standings: [buildEntry()],
        }),
      );

      expect(await screen.findByText(/Abu Dhabi Grand Prix/)).toBeInTheDocument();
      expect(screen.queryByText(/Round/)).not.toBeInTheDocument();
    });

    it('omits the chip row entirely when both currentRound and afterRaceWeekendName are null', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: null,
          totalRounds: 24,
          afterRaceWeekendName: null,
          afterSessionType: null,
          standings: [buildEntry()],
        }),
      );

      expect(await screen.findByRole('heading', { name: 'Pit Wall' })).toBeInTheDocument();
      expect(screen.queryByText(/Round/)).not.toBeInTheDocument();
      expect(screen.queryByText(/After/)).not.toBeInTheDocument();
    });
  });

  describe('after-chip session segment', () => {
    it('appends "· Sprint" when afterSessionType is Sprint', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: 7,
          afterRaceWeekendName: 'Miami Grand Prix',
          afterSessionType: SessionType.Sprint,
          standings: [buildEntry()],
        }),
      );

      const chip = (await screen.findByText(/Miami Grand Prix/)).closest('span');
      expect(chip).not.toBeNull();
      expect(chip).toHaveTextContent(/After\s*Miami Grand Prix\s*·\s*Sprint/);
    });

    it('appends "· Qualifying" when afterSessionType is Qualifying', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: 7,
          afterRaceWeekendName: 'Miami Grand Prix',
          afterSessionType: SessionType.Qualifying,
          standings: [buildEntry()],
        }),
      );

      const chip = (await screen.findByText(/Miami Grand Prix/)).closest('span');
      expect(chip).not.toBeNull();
      expect(chip).toHaveTextContent(/After\s*Miami Grand Prix\s*·\s*Qualifying/);
    });

    it('omits the session segment when afterSessionType is GrandPrix', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          currentRound: 7,
          afterRaceWeekendName: 'Miami Grand Prix',
          afterSessionType: SessionType.GrandPrix,
          standings: [buildEntry()],
        }),
      );

      const chip = (await screen.findByText(/Miami Grand Prix/)).closest('span');
      expect(chip).not.toBeNull();
      expect(chip).toHaveTextContent(/After\s*Miami Grand Prix/);
      expect(chip?.textContent ?? '').not.toMatch(/Grand Prix\s*·\s*Grand Prix/);
      expect(chip?.textContent ?? '').not.toMatch(/·/);
    });
  });
});
