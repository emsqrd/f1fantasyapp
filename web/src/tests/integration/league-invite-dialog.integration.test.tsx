import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { League } from '@/components/League/League';
import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import { requireAuth, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { getLeagueById } from '@/services/leagueService';
import { API_BASE, server } from '@/setupTests';
import {
  createMockLeague,
  createMockTeam,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mirrors the production `_authenticated → _team-required → league/$leagueId`
// chain in `router.tsx` so the real guards and loader run against MSW. The
// invite dialog is a self-contained sub-feature of `/league/$leagueId`: it
// lazy-fetches `/leagues/{id}/invite` on first open, caches the response, and
// copies the URL via `navigator.clipboard`. Each is a real boundary, which is
// why this lives at the integration layer rather than as a jsdom unit test of
// the route component.
function buildLeagueRouteTree() {
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

  const leagueRoute = createRoute({
    getParentRoute: () => teamRequiredLayoutRoute,
    path: 'league/$leagueId',
    loader: async ({ params }) => {
      const league = await getLeagueById(Number(params.leagueId));
      if (!league) {
        throw notFound({ routeId: '/_authenticated/_team-required/league/$leagueId' });
      }
      return { league };
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

const OWNER_ID = 1;
const LEAGUE_ID = 7;
const INVITE_TOKEN = 'abc123xyz';

const ownerAuth: AuthContextType = {
  user: { id: 'user-owner' } as User,
  session: {} as Session,
  loading: false,
  isAuthTransitioning: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  startAuthTransition: vi.fn(),
  completeAuthTransition: vi.fn(),
};

const teamContext: TeamContextType = {
  myTeamId: 1,
  hasTeam: true,
  setMyTeamId: vi.fn(),
  refreshMyTeam: vi.fn(),
};

// Profile id matches the league's ownerId so the Invite button renders
// (the button only shows for the owner of a private league).
const baseRouterContext: Omit<RouterContext, 'auth'> = {
  teamContext,
  team: createMockTeam(),
  profile: createMockUserProfile({ id: OWNER_ID }),
  currentSeason: null,
};

function teamHandler() {
  return http.get(`${API_BASE}/me/team`, () => HttpResponse.json(createMockTeam()));
}

function privateLeagueHandler() {
  return http.get(`${API_BASE}/leagues/${LEAGUE_ID}`, () =>
    HttpResponse.json(
      createMockLeague({
        id: LEAGUE_ID,
        name: 'Pit Wall',
        ownerId: OWNER_ID,
        isPrivate: true,
      }),
    ),
  );
}

const inviteUrl = `${window.location.origin}/join/${INVITE_TOKEN}`;

/**
 * Stubs `navigator.clipboard` for the current test and returns the spy that
 * `useClipboard` will call. Defined inline per test (after `userEvent.setup()`)
 * so the order of setup vs. user-event's own clipboard polyfill is explicit.
 */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

afterEach(() => {
  // Drop the stub so unrelated tests don't see our spy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).clipboard;
});

describe('Share invite dialog', () => {
  it('lazily fetches the invite when opened and renders the shareable URL', async () => {
    const user = userEvent.setup();
    const inviteFetch = vi.fn(() =>
      HttpResponse.json({
        id: 1,
        leagueId: LEAGUE_ID,
        token: INVITE_TOKEN,
        shareableUrl: inviteUrl,
      }),
    );

    server.use(
      teamHandler(),
      privateLeagueHandler(),
      http.post(`${API_BASE}/leagues/${LEAGUE_ID}/invite`, inviteFetch),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: `/league/${LEAGUE_ID}`,
      auth: ownerAuth,
      routerContext: baseRouterContext,
    });

    expect(inviteFetch).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: /invite/i }));

    expect(await screen.findByDisplayValue(inviteUrl)).toBeInTheDocument();
    expect(inviteFetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error message when the invite fetch fails', async () => {
    const user = userEvent.setup();

    server.use(
      teamHandler(),
      privateLeagueHandler(),
      http.post(
        `${API_BASE}/leagues/${LEAGUE_ID}/invite`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: `/league/${LEAGUE_ID}`,
      auth: ownerAuth,
      routerContext: baseRouterContext,
    });

    await user.click(await screen.findByRole('button', { name: /invite/i }));

    expect(await screen.findByText('Failed to load invite link')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(inviteUrl)).not.toBeInTheDocument();
  });

  it('caches the invite across dialog reopens (single network call)', async () => {
    const user = userEvent.setup();
    const inviteFetch = vi.fn(() =>
      HttpResponse.json({
        id: 1,
        leagueId: LEAGUE_ID,
        token: INVITE_TOKEN,
        shareableUrl: inviteUrl,
      }),
    );

    server.use(
      teamHandler(),
      privateLeagueHandler(),
      http.post(`${API_BASE}/leagues/${LEAGUE_ID}/invite`, inviteFetch),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: `/league/${LEAGUE_ID}`,
      auth: ownerAuth,
      routerContext: baseRouterContext,
    });

    await user.click(await screen.findByRole('button', { name: /invite/i }));
    expect(await screen.findByDisplayValue(inviteUrl)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /invite/i }));

    expect(screen.getByDisplayValue(inviteUrl)).toBeInTheDocument();
    expect(inviteFetch).toHaveBeenCalledTimes(1);
  });

  it('writes the shareable URL to the clipboard when the copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();

    server.use(
      teamHandler(),
      privateLeagueHandler(),
      http.post(`${API_BASE}/leagues/${LEAGUE_ID}/invite`, () =>
        HttpResponse.json({
          id: 1,
          leagueId: LEAGUE_ID,
          token: INVITE_TOKEN,
          shareableUrl: inviteUrl,
        }),
      ),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: `/league/${LEAGUE_ID}`,
      auth: ownerAuth,
      routerContext: baseRouterContext,
    });

    await user.click(await screen.findByRole('button', { name: /invite/i }));
    await screen.findByDisplayValue(inviteUrl);

    await user.click(screen.getByRole('button', { name: 'Copy invite link' }));

    expect(writeText).toHaveBeenCalledWith(inviteUrl);
  });

  it('closes the dialog when the user presses Escape', async () => {
    const user = userEvent.setup();

    server.use(
      teamHandler(),
      privateLeagueHandler(),
      http.post(`${API_BASE}/leagues/${LEAGUE_ID}/invite`, () =>
        HttpResponse.json({
          id: 1,
          leagueId: LEAGUE_ID,
          token: INVITE_TOKEN,
          shareableUrl: inviteUrl,
        }),
      ),
    );

    renderWithRouter({
      routeTree: buildLeagueRouteTree(),
      initialEntry: `/league/${LEAGUE_ID}`,
      auth: ownerAuth,
      routerContext: baseRouterContext,
    });

    await user.click(await screen.findByRole('button', { name: /invite/i }));
    await screen.findByDisplayValue(inviteUrl);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
