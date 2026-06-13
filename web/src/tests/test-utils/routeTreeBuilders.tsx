// All helpers in this file assume routes are composed under a root route typed
// with `RouterContext`. If a test needs a different context shape, drop down to
// `createRoute` directly — these helpers won't fit.
import { requireAuth, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import {
  type AnyRoute,
  Outlet,
  createRootRouteWithContext,
  createRoute,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * Test utility: builds a root route typed with `RouterContext`. Profile/team are
 * read through the Query cache (primed by loaders/guards), so the root doesn't
 * fetch them — it just hosts the route tree. Pass `component` when the React
 * tree needs a provider wrapper; it defaults to a bare `<Outlet />`.
 */
export function buildRootRoute({ component }: { component?: () => ReactNode } = {}) {
  return createRootRouteWithContext<RouterContext>()({
    component: component ?? (() => <Outlet />),
  });
}

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
    beforeLoad: ({ context, location }: { context: RouterContext; location: { href: string } }) =>
      requireAuth(context, location.href),
    component: () => <Outlet />,
  });
}

/**
 * Test utility: builds the production `_team-required` pathless layout route
 * with the real `requireTeam` guard attached. The guard reads the team through
 * the Query cache, so tests must seed it via the `/me/team` MSW handler. Pass
 * the parent — typically the route returned by {@link buildAuthenticatedLayout}.
 */
export function buildTeamRequiredLayout(parent: AnyRoute) {
  return createRoute({
    getParentRoute: () => parent,
    id: '_team-required',
    beforeLoad: ({ context }: { context: RouterContext }) => requireTeam(context),
    component: () => <Outlet />,
  });
}

export function buildUnauthenticatedLayout(rootRoute: AnyRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    id: '_unauthenticated',
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
