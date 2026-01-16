import type { Team } from '@/contracts/Team';
import type { RouterContext } from '@/lib/router-context';
import { getMyTeam } from '@/services/teamService';
import { redirect } from '@tanstack/react-router';

/**
 * Route guard that requires user authentication.
 *
 * Use this guard in the {@link https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#beforeload-method | beforeLoad}
 * function of any route that requires the user to be authenticated. If the user is not
 * authenticated, they will be redirected to the sign-in page.
 *
 * **Important:** This guard assumes auth has finished loading. The `RouterProvider` should
 * only be rendered after auth is ready (handled in `InnerApp`).
 *
 * @param context - The router context containing auth state
 * @returns A promise that resolves when the auth check is complete
 * @throws Redirects to `/` (landing page with sign-in) if not authenticated
 *
 * @example
 * ```typescript
 * const accountRoute = createRoute({
 *   getParentRoute: () => rootRoute,
 *   path: '/account',
 *   beforeLoad: async ({ context }) => await requireAuth(context),
 *   component: Account,
 * });
 * ```
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes | TanStack Router Authentication Guide}
 */
export async function requireAuth(context: RouterContext): Promise<void> {
  // Throw redirect if user is not authenticated
  if (!context.auth.user) {
    throw redirect({
      to: '/',
      replace: true,
    });
  }
}

/**
 * Route guard that requires the authenticated user to have a team.
 *
 * Use this guard in combination with {@link requireAuth} for routes that require both
 * authentication and team ownership. If the user doesn't have a team, they will be
 * redirected to the create team page.
 *
 * This guard fetches team data directly from the API, following TanStack Router best
 * practice: {@link https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes#the-routebeforeload-option | beforeLoad should fetch required data}
 * rather than relying on async React context state.
 *
 * @param context - The router context containing auth and team state
 * @returns A promise that resolves to the team to be merged into route context
 * @throws Redirects to `/create-team` if user doesn't have a team
 *
 * @example
 * ```typescript
 * const leaguesRoute = createRoute({
 *   getParentRoute: () => rootRoute,
 *   path: '/leagues',
 *   beforeLoad: async ({ context }) => {
 *     await requireAuth(context);
 *     await requireTeam(context);
 *   },
 *   component: LeagueList,
 * });
 * ```
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes | TanStack Router Authentication Guide}
 */
export async function requireTeam(context: RouterContext): Promise<{ team: Team }> {
  // Ensure auth is ready first
  await requireAuth(context);

  // Fetch team data directly to ensure we have the most current state
  // This follows TanStack Router best practice: beforeLoad should fetch
  // required data rather than relying on async React context state
  const team = await getMyTeam();

  // Throw redirect if user doesn't have a team
  if (!team) {
    throw redirect({
      to: '/create-team',
      replace: true,
    });
  }

  // Sync with TeamContext for components that need it
  context.teamContext.setMyTeamId(team.id);

  return { team };
}

/**
 * Route guard that requires the authenticated user to NOT have a team.
 *
 * Use this guard for routes like "create team" where users who already have a team
 * should not be able to access the page. If the user has a team, they will be
 * redirected to the leagues page.
 *
 * This guard fetches team data directly from the API, following TanStack Router best
 * practice: {@link https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes#the-routebeforeload-option | beforeLoad should fetch required data}
 * rather than relying on async React context state. This prevents users with teams
 * from accessing the create-team page, avoiding the
 * {@link https://tanstack.com/router/latest/docs/framework/react/how-to/setup-authentication#protected-route-flashing-before-redirect | protected route flashing}
 * problem.
 *
 * @param context - The router context containing auth and team state
 * @returns A promise that returns null
 * @throws Redirects to `/leagues` if user already has a team
 *
 * @example
 * ```typescript
 * const createTeamRoute = createRoute({
 *   getParentRoute: () => rootRoute,
 *   path: '/create-team',
 *   beforeLoad: async ({ context }) => {
 *     await requireAuth(context);
 *     await requireNoTeam(context);
 *   },
 *   component: CreateTeam,
 * });
 * ```
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes | TanStack Router Authentication Guide}
 */
export async function requireNoTeam(context: RouterContext): Promise<{ team: null }> {
  // Ensure auth is ready first
  await requireAuth(context);

  // Fetch team data directly to ensure we have the most current state
  const team = await getMyTeam();

  // Throw redirect if user already has a team
  if (team) {
    throw redirect({
      to: '/leagues',
      replace: true,
    });
  }

  // Sync with TeamContext for components that need it
  context.teamContext.setMyTeamId(null);

  return { team: null };
}
