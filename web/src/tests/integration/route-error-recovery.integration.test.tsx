import { RouteErrorComponent } from '@/components/RouteErrorComponent/RouteErrorComponent';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import { getAvailableLeagues } from '@/services/leagueService';
import { createUnauthAuth, renderWithRouter } from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

// A route whose loader fails on the first attempt and succeeds on the second.
// The boundary is the production `RouteErrorComponent`, so "Try again" re-runs
// the loader via router.invalidate(). reset() would only clear the boundary and
// re-throw the same loader error — this tree fails against reset and passes
// against invalidate, pinning that the retry actually refetches.
function buildRecoveryRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <h1>Home</h1>,
  });

  const probeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/probe',
    loader: async () => {
      await getAvailableLeagues();
    },
    component: () => <h1>Probe loaded</h1>,
    errorComponent: RouteErrorComponent,
  });

  return rootRoute.addChildren([indexRoute, probeRoute]);
}

describe('Route error recovery', () => {
  it('re-runs the loader and renders the content when the user clicks "Try again"', async () => {
    const user = userEvent.setup();

    let attempts = 0;
    server.use(
      http.get(`${API_BASE}/leagues/available`, () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );

    renderWithRouter({
      routeTree: buildRecoveryRouteTree(),
      initialEntry: '/probe',
      auth: createUnauthAuth(),
    });

    // First load fails → the shared error card, not the route content.
    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /probe loaded/i })).not.toBeInTheDocument();

    // Secondary escape hatch points home for the non-retryable case.
    expect(screen.getByRole('link', { name: /go home/i }).getAttribute('href')).toBe('/');

    await user.click(screen.getByRole('button', { name: /try again/i }));

    // The retry re-ran the loader; the second attempt succeeds and the route renders.
    expect(await screen.findByRole('heading', { name: /probe loaded/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /something went wrong/i }),
    ).not.toBeInTheDocument();
  });
});
