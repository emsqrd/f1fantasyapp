import { CreateTeam } from '@/components/CreateTeam/CreateTeam';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import { requireNoTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/setupTests';
import { createMockTeam, renderWithRouter } from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// `/create-team` lives under the `_no-team` layout in `router.tsx`. The
// integration tree mirrors that chain so the real `requireNoTeam` guard runs
// (GET /me/team must return 404 for the form to render). `CreateTeam` calls
// `useTeam`, which reads from the React `TeamContext`, not router context, so
// the root wraps `<Outlet />` in a `TeamContext.Provider`. Stub destination
// routes (`/team/$teamId`, `/leagues`) exist as bare placeholders so navigation
// targets are resolvable; their rendered titles are how the tests assert
// post-submit navigation landed on the right URL.
function buildCreateTeamRouteTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Outlet />
      </TeamContext.Provider>
    ),
  });

  const noTeamLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_no-team',
    beforeLoad: ({ context }) => requireNoTeam(context),
    component: () => <Outlet />,
  });

  const redirectSearchSchema = z.object({
    redirect: z
      .string()
      .refine((url) => url.startsWith('/'), 'Redirect must be an internal path')
      .optional()
      .catch(undefined),
  });

  const createTeamRoute = createRoute({
    getParentRoute: () => noTeamLayoutRoute,
    path: 'create-team',
    validateSearch: redirectSearchSchema,
    component: CreateTeam,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  const teamByIdRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'team/$teamId',
    component: () => <h1>Team Page</h1>,
  });

  const leaguesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'leagues',
    component: () => <h1>Leagues Page</h1>,
  });

  return rootRoute.addChildren([
    noTeamLayoutRoute.addChildren([createTeamRoute]),
    teamByIdRoute,
    leaguesRoute,
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
    myTeamId: null,
    hasTeam: false,
    setMyTeamId: vi.fn(),
    refreshMyTeam: vi.fn(),
    ...overrides,
  };
}

const baseRouterContext: Omit<RouterContext, 'auth' | 'teamContext'> = {
  team: null,
  profile: null,
  currentSeason: null,
};

describe('Create team', () => {
  it('renders the form when the requireNoTeam guard sees no existing team', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    expect(await screen.findByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  });

  it('creates the team and navigates to /team/$teamId on success', async () => {
    const user = userEvent.setup();
    const createdTeam = createMockTeam({ id: 42, name: 'My Racing Team' });
    let capturedBody: unknown = null;

    server.use(
      http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${API_BASE}/teams`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(createdTeam);
      }),
    );

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    await user.type(await screen.findByLabelText(/team name/i), '  My Racing Team  ');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByRole('heading', { name: 'Team Page' })).toBeInTheDocument();
    // Wire contract: schema trims whitespace; CreateTeam sends `{ name }`.
    expect(capturedBody).toEqual({ name: 'My Racing Team' });
  });

  it('surfaces an InlineError when team creation fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${API_BASE}/teams`, () => new HttpResponse(null, { status: 500 })),
    );

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    await user.type(await screen.findByLabelText(/team name/i), 'Team Name');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Stayed on the form — no navigation.
    expect(screen.queryByRole('heading', { name: 'Team Page' })).not.toBeInTheDocument();
  });

  it('blocks submit and shows a field error when team name is empty', async () => {
    const user = userEvent.setup();

    // No POST handler on purpose — MSW runs in strict mode (see `setupTests.ts`),
    // so any unexpected POST /teams would fail the test loudly.
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(teamContext),
      initialEntry: '/create-team',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    await user.click(await screen.findByRole('button', { name: /create team/i }));

    expect(await screen.findByText(/team name is required/i)).toBeInTheDocument();
  });

  it('navigates to the redirect search param when provided', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${API_BASE}/teams`, () => HttpResponse.json(createMockTeam({ id: 7 }))),
    );

    const teamContext = makeTeamContext();
    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(teamContext),
      initialEntry: '/create-team?redirect=/leagues',
      auth: authedAuth,
      routerContext: { ...baseRouterContext, teamContext },
    });

    await user.type(await screen.findByLabelText(/team name/i), 'My Racing Team');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByRole('heading', { name: 'Leagues Page' })).toBeInTheDocument();
  });
});
