import { League } from '@/components/League/League';
import type { LeagueStandings, TeamLeagueStanding } from '@/contracts/LeagueStandings';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { leagueQueries } from '@/services/leagueService';
import { standingsQueries } from '@/services/standingsService';
import {
  buildAuthenticatedLayout,
  buildTeamRequiredLayout,
  createAuthedAuth,
  createMockLeague,
  createMockLeagueStandings,
  createMockTeam,
  createMockUserProfile,
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
    loader: async ({ params, context }) => {
      const ROUTE_ID = '/_authenticated/_team-required/league/$leagueId';
      const leagueId = Number(params.leagueId);
      const [league, standings] = await Promise.all([
        context.queryClient.ensureQueryData(leagueQueries.byId(leagueId)),
        context.queryClient.ensureQueryData(standingsQueries.forLeague(leagueId)),
      ]);
      if (!league || !standings) {
        throw notFound({ routeId: ROUTE_ID });
      }
    },
    component: League,
    notFoundComponent: () => <h1>League Not Found</h1>,
  });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([teamRequiredLayoutRoute.addChildren([leagueRoute])]),
  ]);
}

function renderLeaguePage(standings: LeagueStandings) {
  // The leaderboard marks the viewer's own row by matching `profile.id` (read
  // through the query) against each row's ownerId; the `/me/team` handler
  // satisfies the `requireTeam` guard on the layout.
  server.use(
    http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam())),
    http.get(`${API_BASE}/me/profile`, () =>
      HttpResponse.json(createMockUserProfile({ id: VIEWER_ID })),
    ),
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
  });
}

function buildTeamLeagueStanding(overrides: Partial<TeamLeagueStanding> = {}): TeamLeagueStanding {
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
        lastScoredRound: 7,
        lastScoredRaceWeekendName: 'Miami Grand Prix',
        standings: [
          buildTeamLeagueStanding({
            teamId: 10,
            teamName: 'Lightning McQueen',
            ownerId: 1,
            ownerName: 'Sally',
            position: 1,
            totalPoints: 1234,
            positionChange: 2,
          }),
          buildTeamLeagueStanding({
            teamId: 11,
            teamName: 'Banana Boat',
            ownerId: 2,
            ownerName: 'Mater',
            position: 2,
            totalPoints: 999,
            positionChange: -1,
          }),
          buildTeamLeagueStanding({
            teamId: 12,
            teamName: 'Status Quo',
            ownerId: 3,
            ownerName: 'Doc',
            position: 3,
            totalPoints: 500,
            positionChange: 0,
          }),
          buildTeamLeagueStanding({
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
          buildTeamLeagueStanding({ teamId: 10, ownerId: 1, position: 1, teamName: 'Other Team' }),
          buildTeamLeagueStanding({
            teamId: 11,
            ownerId: VIEWER_ID,
            position: 2,
            teamName: 'My Team',
          }),
          buildTeamLeagueStanding({
            teamId: 12,
            ownerId: 3,
            position: 3,
            teamName: 'Another Team',
          }),
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
          buildTeamLeagueStanding({ teamId: 10, ownerId: 1, position: 1, teamName: 'Other Team' }),
          buildTeamLeagueStanding({
            teamId: 11,
            ownerId: VIEWER_ID,
            position: 2,
            teamName: 'My Team',
          }),
        ],
      }),
    );

    const myLink = await screen.findByRole('link', { name: /Open My Team, your team/ });
    expect(myLink).toHaveAttribute('href', '/my-team');

    const otherLink = screen.getByRole('link', { name: /Open Other Team/ });
    expect(otherLink).toHaveAttribute('href', '/team/10');
  });

  describe('header eyebrow', () => {
    it('renders "Round {N} · {RACE_NAME}" when both lastScoredRound and lastScoredRaceWeekendName are set', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          lastScoredRound: 7,
          lastScoredRaceWeekendName: 'Miami GP',
          standings: [buildTeamLeagueStanding()],
        }),
      );

      const heading = await screen.findByRole('heading', { name: 'Pit Wall' });
      const eyebrow = heading.parentElement?.previousElementSibling;
      expect(eyebrow?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^round 7 · miami gp$/i);
    });

    it('renders no eyebrow when both fields are null', async () => {
      renderLeaguePage(
        createMockLeagueStandings({
          lastScoredRound: null,
          lastScoredRaceWeekendName: null,
          standings: [buildTeamLeagueStanding()],
        }),
      );

      const heading = await screen.findByRole('heading', { name: 'Pit Wall' });
      expect(heading.parentElement?.previousElementSibling).toBeNull();
    });
  });
});
