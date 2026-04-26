import type { AuthContextType } from '@/contexts/AuthContext';
import { AuthContext } from '@/contexts/AuthContext';
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
}

/**
 * Mounts a TanStack Router instance over a caller-supplied route tree, wrapped
 * in an AuthContext provider, for frontend integration tests.
 *
 * The caller owns the route tree so each test can mount the smallest viable
 * subset of routes. The auth value must be supplied in full — no defaults — so
 * tests stay explicit about which auth state they're exercising.
 */
export function renderWithRouter({ routeTree, initialEntry, auth }: RenderWithRouterOptions) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  return render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
}
