import { CreateTeam } from '@/components/CreateTeam/CreateTeam';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildNoTeamLayout,
  buildRootRoute,
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
  createMockTeam,
  renderWithRouter,
} from '@/tests/test-utils';
import { createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// `/create-team` lives under the `_authenticated` → `_no-team` layout chain in
// `router.tsx`. The integration tree mirrors that chain, and the root
// `beforeLoad` (via `buildRootRoute`) fetches the team into `context.team` —
// `requireNoTeam` reads it, so GET /me/team must return 404 for the form to
// render. Stub destination routes (`/team/$teamId`, `/leagues`) exist as bare
// placeholders so navigation targets are resolvable; their rendered titles are
// how the tests assert post-submit navigation landed on the right URL.
function buildCreateTeamRouteTree() {
  const rootRoute = buildRootRoute();

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);
  const noTeamLayoutRoute = buildNoTeamLayout(authenticatedLayoutRoute);

  const redirectSearchSchema = z.object({
    redirect: z
      .string()
      .refine((url) => url.startsWith('/'), 'Redirect must be an internal path')
      .optional()
      .catch(undefined),
  });

  const createTeamRoute = createRoute({
    getParentRoute: () => noTeamLayoutRoute,
    path: 'create-team',
    validateSearch: redirectSearchSchema,
    component: CreateTeam,
    errorComponent: ({ error }) => (
      <ErrorBoundary level="page">
        <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
      </ErrorBoundary>
    ),
  });

  const teamByIdRoute = buildStubRoute(rootRoute, { path: 'team/$teamId', heading: 'Team Page' });
  const leaguesRoute = buildStubRoute(rootRoute, { path: 'leagues', heading: 'Leagues Page' });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([noTeamLayoutRoute.addChildren([createTeamRoute])]),
    teamByIdRoute,
    leaguesRoute,
  ]);
}

describe('Create team', () => {
  it('renders the form when the requireNoTeam guard sees no existing team', async () => {
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  });

  it('creates the team and navigates to /team/$teamId on success', async () => {
    const user = userEvent.setup();
    const createdTeam = createMockTeam({ id: 42, name: 'My Racing Team' });
    let capturedBody: unknown = null;

    server.use(
      http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${API_BASE}/teams`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(createdTeam);
      }),
    );

    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.type(await screen.findByLabelText(/team name/i), '  My Racing Team  ');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByRole('heading', { name: 'Team Page' })).toBeInTheDocument();
    // Wire contract: schema trims whitespace; CreateTeam sends `{ name }`.
    expect(capturedBody).toEqual({ name: 'My Racing Team' });
  });

  it('surfaces an InlineError when team creation fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${API_BASE}/teams`, () => new HttpResponse(null, { status: 500 })),
    );

    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.type(await screen.findByLabelText(/team name/i), 'Team Name');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Stayed on the form — no navigation.
    expect(screen.queryByRole('heading', { name: 'Team Page' })).not.toBeInTheDocument();
  });

  it('blocks submit and shows a field error when team name is empty', async () => {
    const user = userEvent.setup();

    // No POST handler on purpose — MSW runs in strict mode (see `setupTests.ts`),
    // so any unexpected POST /teams would fail the test loudly.
    server.use(http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })));

    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /create team/i }));

    expect(await screen.findByText(/team name is required/i)).toBeInTheDocument();
  });

  it('navigates to the redirect search param when provided', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/me/team`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${API_BASE}/teams`, () => HttpResponse.json(createMockTeam({ id: 7 }))),
    );

    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team?redirect=/leagues',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.type(await screen.findByLabelText(/team name/i), 'My Racing Team');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByRole('heading', { name: 'Leagues Page' })).toBeInTheDocument();
  });
});
