import { type Auth, routerAuth, seedAuthStore } from '@/lib/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRoute,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';

export interface RenderWithRouterOptions {
  routeTree: AnyRoute;
  initialEntry: string;
  auth: Auth;
}

/**
 * Mounts a TanStack Router instance over a caller-supplied route tree for
 * frontend integration tests. The `auth` value seeds the auth store; `useAuth`
 * consumers and the router context (a live view over the store, as in
 * production) both read that seeded state.
 *
 * The caller owns the route tree so each test can mount the smallest viable
 * subset of routes. The auth value must be supplied in full — no default — so
 * tests stay explicit about which auth state they're exercising.
 *
 * Route trees that exercise route guards or loaders that read context should
 * be created with `createRootRouteWithContext<RouterContext>()` so guards run
 * against the same shape as production.
 *
 * Returns the React Testing Library result plus the per-test `queryClient`, so
 * tests can seed or assert against the Query cache directly.
 */
export function renderWithRouter({ routeTree, initialEntry, auth }: RenderWithRouterOptions) {
  seedAuthStore(auth);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { auth: routerAuth, queryClient },
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    queryClient,
    router,
  };
}
