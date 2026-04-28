import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { JoinInvite } from '@/components/JoinInvite/JoinInvite';
import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import type { RouterContext } from '@/lib/router-context';
import { previewInvite } from '@/services/leagueInviteService';
import { API_BASE, server } from '@/setupTests';
import { createMockUserProfile, renderWithRouter } from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext, createRoute, notFound } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

// `/join/$token` is a public top-level route — not under `_authenticated`. The
// integration tree mirrors `joinInviteRoute` from `router.tsx` plus minimal
// stub routes for the destinations the JoinInvite Link components target
// (`/sign-in`, `/sign-up`, `/create-team`). Stubs are bare placeholders — the
// component bodies never render in these tests; they exist so TanStack Router
// can resolve the `to` props and produce hrefs with the redirect query string.
//
// `JoinInvite` calls `useTeam`, which reads from the React `TeamContext`, not
// router context. The root route wraps `<Outlet />` in a `TeamContext.Provider`
// so the per-test `teamContextValue` flows through to the component.
function buildJoinInviteRouteTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
    notFoundComponent: () => <h1>404 - Page Not Found</h1>,
  });

  const joinInviteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/join/$token',
    component: JoinInvite,
    loader: async ({ params }) => {
      try {
        const preview = await previewInvite(params.token);
        return { preview };
      } catch {
        throw notFound({ routeId: '/join/$token' });
      }
    },
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  // `validateSearch` is required for `<Link search={{ redirect }}>` to serialize
  // the param into the rendered href; the rest is intentionally bare.
  const redirectSearch = (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  });

  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-in',
    validateSearch: redirectSearch,
    component: () => null,
  });

  const signUpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-up',
    validateSearch: redirectSearch,
    component: () => null,
  });

  const createTeamRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/create-team',
    validateSearch: redirectSearch,
    component: () => null,
  });

  return rootRoute.addChildren([joinInviteRoute, signInRoute, signUpRoute, createTeamRoute]);
}

const unauthAuth: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  isAuthTransitioning: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  startAuthTransition: vi.fn(),
  completeAuthTransition: vi.fn(),
};

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

const noTeamContext: TeamContextType = {
  myTeamId: null,
  hasTeam: false,
  setMyTeamId: vi.fn(),
  refreshMyTeam: vi.fn(),
};

const withTeamContext: TeamContextType = {
  myTeamId: 1,
  hasTeam: true,
  setMyTeamId: vi.fn(),
  refreshMyTeam: vi.fn(),
};

const baseRouterContext: Omit<RouterContext, 'auth'> = {
  teamContext: noTeamContext,
  team: null,
  profile: createMockUserProfile(),
  currentSeason: null,
};

const TOKEN = 'abc-token';

function previewHandler(overrides: Partial<Record<string, unknown>> = {}) {
  return http.get(`${API_BASE}/leagues/join/${TOKEN}/preview`, () =>
    HttpResponse.json({
      leagueName: 'COTA Champions',
      leagueDescription: 'Battle for the lonestar cup',
      ownerName: 'Ada Lovelace',
      currentTeamCount: 5,
      maxTeams: 10,
      isLeagueFull: false,
      ...overrides,
    }),
  );
}

describe('Join via invite token', () => {
  it('shows sign-in and create-account links carrying a redirect back to the invite for unauthenticated users', async () => {
    server.use(previewHandler());

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(noTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: unauthAuth,
      routerContext: baseRouterContext,
    });

    const signInLink = await screen.findByRole('link', { name: /sign in to join/i });
    const createAccountLink = screen.getByRole('link', { name: /create account/i });

    expect(signInLink.getAttribute('href')).toContain('/sign-in');
    expect(signInLink.getAttribute('href')).toContain(
      `redirect=${encodeURIComponent(`/join/${TOKEN}`)}`,
    );
    expect(createAccountLink.getAttribute('href')).toContain('/sign-up');
    expect(createAccountLink.getAttribute('href')).toContain(
      `redirect=${encodeURIComponent(`/join/${TOKEN}`)}`,
    );

    expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
  });

  it('shows a create-team link carrying a redirect back to the invite for authed users without a team', async () => {
    server.use(previewHandler());

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(noTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: baseRouterContext,
    });

    const createTeamLink = await screen.findByRole('link', { name: /create team/i });
    expect(createTeamLink.getAttribute('href')).toContain('/create-team');
    expect(createTeamLink.getAttribute('href')).toContain(
      `redirect=${encodeURIComponent(`/join/${TOKEN}`)}`,
    );

    expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).not.toBeInTheDocument();
  });

  it('shows the join-league button for authed users with a team', async () => {
    server.use(previewHandler());

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(withTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: withTeamContext },
    });

    expect(await screen.findByRole('button', { name: /join league/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).not.toBeInTheDocument();
  });

  it('renders the route 404 fallback when the loader rejects with an invalid token', async () => {
    server.use(
      http.get(
        `${API_BASE}/leagues/join/${TOKEN}/preview`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(noTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: unauthAuth,
      routerContext: baseRouterContext,
    });

    expect(
      await screen.findByRole('heading', { name: /404 - Page Not Found/i }),
    ).toBeInTheDocument();
  });

  it('shows the league-full alert and hides action buttons when preview reports the league is full', async () => {
    server.use(previewHandler({ isLeagueFull: true }));

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(withTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: withTeamContext },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This league is full and cannot accept new members.',
    );
    expect(screen.queryByRole('button', { name: /join league/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).not.toBeInTheDocument();
  });

  it('surfaces an inline error and stays on the invite page when the join request fails', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      http.post(
        `${API_BASE}/leagues/join/${TOKEN}`,
        () =>
          new HttpResponse(JSON.stringify({ detail: 'Server is on fire' }), {
            status: 500,
            headers: { 'content-type': 'application/problem+json' },
          }),
      ),
    );

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(withTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: withTeamContext },
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server is on fire');
    // Still on the invite page: the join button is rebound after `isJoining` resets.
    expect(screen.getByRole('button', { name: /join league/i })).toBeInTheDocument();
  });

  it('surfaces "Failed to join league" when the join request returns an empty body', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      // 204 makes apiClient resolve to null, which the component treats as failure.
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, () => new HttpResponse(null, { status: 204 })),
    );

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(withTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: withTeamContext },
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to join league');
  });

  it('clears the previous error when the user retries the join', async () => {
    const user = userEvent.setup();

    let attempts = 0;
    server.use(
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, async () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(JSON.stringify({ detail: 'first error' }), {
            status: 500,
            headers: { 'content-type': 'application/problem+json' },
          });
        }
        // Hang so the second attempt stays in-flight while we observe the
        // pre-await `setError(null)` clearing the previous alert.
        await new Promise(() => {});
        return HttpResponse.json({});
      }),
    );

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(withTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: withTeamContext },
    });

    const joinButton = await screen.findByRole('button', { name: /join league/i });
    await user.click(joinButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('first error');

    await user.click(screen.getByRole('button', { name: /join league/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('shows a "Joining..." loading state while the join request is in flight', async () => {
    const user = userEvent.setup();

    server.use(
      previewHandler(),
      http.post(`${API_BASE}/leagues/join/${TOKEN}`, async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      }),
    );

    renderWithRouter({
      routeTree: buildJoinInviteRouteTree(withTeamContext),
      initialEntry: `/join/${TOKEN}`,
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext: withTeamContext },
    });

    await user.click(await screen.findByRole('button', { name: /join league/i }));

    expect(await screen.findByRole('button', { name: /joining/i })).toBeInTheDocument();
  });
});
