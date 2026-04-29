import { Account } from '@/components/Account/Account';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import type { RouterContext } from '@/lib/router-context';
import { userProfileService } from '@/services/userProfileService';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  createAuthedAuth,
  createBaseRouterContext,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

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

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);

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

describe('Account page', () => {
  it('renders profile data fetched by the loader', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ displayName: 'Ada Lovelace' })),
      ),
    );

    renderWithRouter({
      routeTree: buildAccountRouteTree(),
      initialEntry: '/account',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument();
  });

  it('renders the route errorComponent when the profile fetch fails', async () => {
    server.use(http.get(`${API_BASE}/me/profile`, () => new HttpResponse(null, { status: 500 })));

    renderWithRouter({
      routeTree: buildAccountRouteTree(),
      initialEntry: '/account',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });
});
