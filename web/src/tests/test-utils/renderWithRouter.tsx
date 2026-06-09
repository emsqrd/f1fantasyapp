import type { AuthContextType } from '@/contexts/AuthContext';
import { AuthContext } from '@/contexts/AuthContext';
import type { RouterContext } from '@/lib/router-context';
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
  auth: AuthContextType;
  /**
   * Router-level context for `createRouter` beyond `auth` and `queryClient`
   * (both wired automatically — `auth` from the option above, `queryClient` as a
   * fresh per-test client — so route guards and the React tree always see the
   * same values). Profile/team/season are read through the Query cache, so
   * nothing else remains in `RouterContext` to supply — hence optional.
   */
  routerContext?: Omit<RouterContext, 'auth' | 'queryClient'>;
}

/**
 * Mounts a TanStack Router instance over a caller-supplied route tree, wrapped
 * in an AuthContext provider, for frontend integration tests.
 *
 * The caller owns the route tree so each test can mount the smallest viable
 * subset of routes. The auth value and router context must be supplied in full
 * — no defaults — so tests stay explicit about which state they're exercising.
 *
 * Route trees that exercise route guards or loaders that read context should
 * be created with `createRootRouteWithContext<RouterContext>()` so guards run
 * against the same shape as production.
 *
 * Returns the React Testing Library result plus the per-test `queryClient`, so
 * tests can seed or assert against the Query cache directly.
 */
export function renderWithRouter({
  routeTree,
  initialEntry,
  auth,
  routerContext = {},
}: RenderWithRouterOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { ...routerContext, auth, queryClient },
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}
