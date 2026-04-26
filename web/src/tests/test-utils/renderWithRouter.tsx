import type { AuthContextType } from '@/contexts/AuthContext';
import { AuthContext } from '@/contexts/AuthContext';
import type { RouterContext } from '@/lib/router-context';
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
   * Router-level context for `createRouter`. `auth` is wired automatically
   * from the `auth` option above so route guards (e.g. `requireAuth`) and the
   * React tree always see the same auth value. Callers supply the rest of
   * `RouterContext` so tests stay explicit about which router state they're
   * exercising.
   */
  routerContext: Omit<RouterContext, 'auth'>;
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
 */
export function renderWithRouter({
  routeTree,
  initialEntry,
  auth,
  routerContext,
}: RenderWithRouterOptions) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { ...routerContext, auth },
  });

  return render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
}
