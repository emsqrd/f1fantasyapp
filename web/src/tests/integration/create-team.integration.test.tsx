import { CreateTeam } from '@/components/CreateTeam/CreateTeam';
import { safeInternalPath } from '@/lib/safeInternalPath';
import { myTeamQuery } from '@/services/teamService';
import { API_BASE, server } from '@/setupTests';
import {
  buildAuthenticatedLayout,
  buildRootRoute,
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
  createMockTeam,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import { createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// `/create-team` lives directly under the `_authenticated` layout in
// `router.tsx` — the one-team-per-user rule is enforced by the backend, and
// `CreateTeam` itself decides between the form and an already-have-a-team state
// from `profile.hasTeam`. The default MSW handlers seed a no-team profile, so the
// form renders without per-test setup; the has-team case overrides `/me/profile`.
// Stub destination routes (`/team/$teamId`, `/leagues`) exist as bare
// placeholders so navigation targets are resolvable; their rendered titles are
// how the tests assert navigation landed on the right URL.
function buildCreateTeamRouteTree() {
  const rootRoute = buildRootRoute();

  const authenticatedLayoutRoute = buildAuthenticatedLayout(rootRoute);

  const redirectSearchSchema = z.object({
    redirect: z.string().optional().catch(undefined).transform(safeInternalPath),
  });

  const createTeamRoute = createRoute({
    getParentRoute: () => authenticatedLayoutRoute,
    path: 'create-team',
    validateSearch: redirectSearchSchema,
    component: CreateTeam,
  });

  const teamByIdRoute = buildStubRoute(rootRoute, { path: 'team/$teamId', heading: 'Team Page' });
  const leaguesRoute = buildStubRoute(rootRoute, { path: 'leagues', heading: 'Leagues Page' });

  return rootRoute.addChildren([
    authenticatedLayoutRoute.addChildren([createTeamRoute]),
    teamByIdRoute,
    leaguesRoute,
  ]);
}

describe('Create team', () => {
  it('renders the form for a user without a team', async () => {
    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  });

  it('shows the already-have-a-team state instead of the form for a user with a team', async () => {
    server.use(
      http.get(`${API_BASE}/me/profile`, () =>
        HttpResponse.json(createMockUserProfile({ hasTeam: true })),
      ),
    );

    renderWithRouter({
      routeTree: buildCreateTeamRouteTree(),
      initialEntry: '/create-team',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByText(/only have one team per season/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/team name/i)).not.toBeInTheDocument();
  });

  it('creates the team and navigates to /team/$teamId on success', async () => {
    const user = userEvent.setup();
    const createdTeam = createMockTeam({ id: 42, name: 'My Racing Team' });
    let capturedBody: unknown = null;

    server.use(
      http.post(`${API_BASE}/teams`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(createdTeam);
      }),
    );

    const { queryClient } = renderWithRouter({
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
    // The POST response is slimmer than GET /me/team, so the team query must be
    // evicted, not seeded with it — the next guard read fetches the full shape.
    expect(queryClient.getQueryData(myTeamQuery.queryKey)).toBeUndefined();
  });

  it('surfaces an InlineError when team creation fails', async () => {
    const user = userEvent.setup();

    server.use(http.post(`${API_BASE}/teams`, () => new HttpResponse(null, { status: 500 })));

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

    server.use(http.post(`${API_BASE}/teams`, () => HttpResponse.json(createMockTeam({ id: 7 }))));

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
