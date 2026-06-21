import { Account } from '@/components/Account/Account';
import { RouteErrorComponent } from '@/components/RouteErrorComponent/RouteErrorComponent';
import type { UserProfile } from '@/contracts/UserProfile';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { profileQuery } from '@/services/userProfileService';
import {
  buildAuthenticatedLayout,
  createAuthedAuth,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
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
    loader: async ({ context }) => {
      await context.queryClient.ensureQueryData(profileQuery);
    },
    component: Account,
    errorComponent: RouteErrorComponent,
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
    });

    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument();
  });

  it('renders the route errorComponent when the profile fetch fails', async () => {
    server.use(http.get(`${API_BASE}/me/profile`, () => new HttpResponse(null, { status: 500 })));

    renderWithRouter({
      routeTree: buildAccountRouteTree(),
      initialEntry: '/account',
      auth: createAuthedAuth(),
    });

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it('refetches the profile after a save so persistent consumers see the update', async () => {
    const user = userEvent.setup();
    let stored = createMockUserProfile({ displayName: 'Original' });
    server.use(
      http.get(`${API_BASE}/me/profile`, () => HttpResponse.json(stored)),
      http.patch(`${API_BASE}/me/profile`, async ({ request }) => {
        stored = (await request.json()) as UserProfile;
        return HttpResponse.json(stored);
      }),
    );

    const { queryClient } = renderWithRouter({
      routeTree: buildAccountRouteTree(),
      initialEntry: '/account',
      auth: createAuthedAuth(),
    });

    const displayName = await screen.findByDisplayValue('Original');
    await user.clear(displayName);
    await user.type(displayName, 'Updated');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await screen.findAllByText(/profile updated successfully/i);
    // The query cache — read by the always-mounted sidebar — now holds the new name.
    expect(queryClient.getQueryData(profileQuery.queryKey)).toMatchObject({
      displayName: 'Updated',
    });
  });
});
