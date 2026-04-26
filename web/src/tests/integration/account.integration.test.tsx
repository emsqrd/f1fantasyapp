import { Account } from '@/components/Account/Account';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import { requireAuth } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { userProfileService } from '@/services/userProfileService';
import { API_BASE, server } from '@/setupTests';
import { createMockUserProfile, renderWithRouter } from '@/tests/test-utils';
import type { Session, User } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

// Minimal route tree mirroring the production `/account` shape:
// a pathless `_authenticated` parent + `account` child produces the route id
// `/_authenticated/account`, which is what the Account component looks up via
// `getRouteApi`. The layout runs the real `requireAuth` guard so the test
// exercises the production wiring (guard → loader → component) end-to-end.
// Loader, component, and errorComponent are mirrored from `accountRoute` in
// `router.tsx` because that route's parent is fixed at definition time and
// can't be re-parented for tests.
function buildAccountRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authenticatedLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: ({ context }) => requireAuth(context),
    component: () => <Outlet />,
  });

  const accountRoute = createRoute({
    getParentRoute: () => authenticatedLayoutRoute,
    path: 'account',
    loader: async () => ({ userProfile: await userProfileService.getCurrentProfile() }),
    component: Account,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  return rootRoute.addChildren([authenticatedLayoutRoute.addChildren([accountRoute])]);
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

const teamContext: TeamContextType = {
  myTeamId: null,
  hasTeam: false,
  setMyTeamId: vi.fn(),
  refreshMyTeam: vi.fn(),
};

const baseRouterContext: Omit<RouterContext, 'auth'> = {
  teamContext,
  team: null,
  profile: null,
  currentSeason: null,
};

describe('/account integration', () => {
  it('renders profile data fetched by the loader', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ displayName: 'Ada Lovelace' })),
      ),
    );

    renderWithRouter({
      routeTree: buildAccountRouteTree(),
      initialEntry: '/account',
      auth: authedAuth,
      routerContext: baseRouterContext,
    });

    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument();
  });

  it('renders the route errorComponent when the profile fetch fails', async () => {
    server.use(http.get(`${API_BASE}/me/profile`, () => new HttpResponse(null, { status: 500 })));

    renderWithRouter({
      routeTree: buildAccountRouteTree(),
      initialEntry: '/account',
      auth: authedAuth,
      routerContext: baseRouterContext,
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });
});
