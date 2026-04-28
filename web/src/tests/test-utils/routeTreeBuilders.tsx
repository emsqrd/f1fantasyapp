// All helpers in this file assume routes are composed under a root route typed
// with `RouterContext`. If a test needs a different context shape, drop down to
// `createRoute` directly — these helpers won't fit.
import { requireAuth, requireNoTeam, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { type AnyRoute, Outlet, createRoute } from '@tanstack/react-router';

/**
 * Test utility: builds the production `_authenticated` pathless layout route
 * with the real `requireAuth` guard attached.
 *
 * Used by integration tests that mirror production routing under the
 * authenticated layout. Centralizing here keeps the guard wiring in one place
 * so a `requireAuth` change touches one file, not every integration test.
 */
export function buildAuthenticatedLayout(rootRoute: AnyRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: ({ context }: { context: RouterContext }) => requireAuth(context),
    component: () => <Outlet />,
  });
}

/**
 * Test utility: builds the production `_team-required` pathless layout route
 * with the real `requireTeam` guard attached. Pass the parent — typically the
 * route returned by {@link buildAuthenticatedLayout}.
 */
export function buildTeamRequiredLayout(parent: AnyRoute) {
  return createRoute({
    getParentRoute: () => parent,
    id: '_team-required',
    beforeLoad: ({ context }: { context: RouterContext }) => requireTeam(context),
    component: () => <Outlet />,
  });
}

/**
 * Test utility: builds the production `_no-team` pathless layout route with
 * the real `requireNoTeam` guard attached.
 *
 * Used by integration tests that exercise routes only available before a user
 * has created a team (e.g. `/create-team`).
 */
export function buildNoTeamLayout(rootRoute: AnyRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    id: '_no-team',
    beforeLoad: ({ context }: { context: RouterContext }) => requireNoTeam(context),
    component: () => <Outlet />,
  });
}

interface StubRouteOptions {
  path: string;
  heading: string;
}

/**
 * Test utility: builds a placeholder destination route for redirect/navigation
 * targets in integration tests. The heading text is the test's assertion
 * surface — `findByRole('heading', { name: heading })` confirms which stub the
 * navigation landed on.
 */
export function buildStubRoute(parent: AnyRoute, { path, heading }: StubRouteOptions) {
  return createRoute({
    getParentRoute: () => parent,
    path,
    component: () => <h1>{heading}</h1>,
  });
}
