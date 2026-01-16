import { Account } from '@/components/Account/Account';
import { CreateTeam } from '@/components/CreateTeam/CreateTeam';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { LandingPage } from '@/components/LandingPage/LandingPage';
import { Layout } from '@/components/Layout/Layout';
import { League } from '@/components/League/League';
import { LeagueList } from '@/components/LeagueList/LeagueList';
import { Team } from '@/components/Team/Team';
import { SignInForm } from '@/components/auth/SignInForm/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm/SignUpForm';
import type { Team as TeamType } from '@/contracts/Team';
import type { UserProfile } from '@/contracts/UserProfile';
import { requireAuth, requireNoTeam, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { getLeagueById, getMyLeagues } from '@/services/leagueService';
import { getMyTeam, getTeamById } from '@/services/teamService';
import { userProfileService } from '@/services/userProfileService';
import * as Sentry from '@sentry/react';
import {
  ErrorComponent,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  notFound,
  redirect,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { z } from 'zod';

/**
 * Zod schema for validating league ID route parameter.
 *
 * Ensures leagueId is:
 * - Coerced from string to number
 * - An integer
 * - A positive value (> 0)
 *
 * @see {@link https://zod.dev/?id=coercion-for-primitives | Zod Coercion}
 */
const leagueIdParamsSchema = z.object({
  leagueId: z.coerce
    .number({ message: 'League ID must be a number' })
    .int('League ID must be an integer')
    .positive('League ID must be positive'),
});

/**
 * Zod schema for validating team ID route parameter.
 *
 * Ensures teamId is:
 * - Coerced from string to number
 * - An integer
 * - A positive value (> 0)
 *
 * @see {@link https://zod.dev/?id=coercion-for-primitives | Zod Coercion}
 */
const teamIdParamsSchema = z.object({
  teamId: z.coerce
    .number({ message: 'Team ID must be a number' })
    .int('Team ID must be an integer')
    .positive('Team ID must be positive'),
});

/**
 * Root route with context - wraps all routes in the application.
 *
 * Provides the base layout with {@link Layout} component and dev tools.
 * All child routes inherit context containing auth and team state.
 *
 * @type {import('@tanstack/react-router').RootRoute<RouterContext>}
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/api/router/createRootRouteWithContextFunction | createRootRouteWithContext}
 */
const rootRoute = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    // Fetch profile and team for authenticated users at root level
    // This makes them available to all routes (both public and authenticated)
    if (context.auth.user) {
      try {
        const [profile, team] = await Promise.all([
          userProfileService.getCurrentProfile(),
          getMyTeam(),
        ]);

        // Sync team ID with TeamContext for components that need it
        context.teamContext.setMyTeamId(team?.id ?? null);

        return { profile };
      } catch (error) {
        // Gracefully degrade if profile/team fetching fails
        // The app should still work without profile data
        const fetchError = error instanceof Error ? error : new Error('Failed to fetch user data');

        Sentry.captureException(fetchError, {
          tags: {
            component: 'rootRoute',
            operation: 'beforeLoad',
          },
          contexts: {
            user: {
              userId: context.auth.user.id,
            },
          },
        });

        // Ensure TeamContext is in a known state
        context.teamContext.setMyTeamId(null);

        return { profile: null };
      }
    }
    return { profile: null };
  },
  component: () => (
    <>
      <Layout />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} onReset={reset} level="page" />
    </ErrorBoundary>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">404 - Page Not Found</h1>
      <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist.</p>
      <a href="/" className="text-primary hover:underline">
        Go back home
      </a>
    </div>
  ),
});

/**
 * Landing page route - public route accessible to all users.
 *
 * Displays marketing content and sign-in/sign-up options for unauthenticated users.
 * Authenticated users with teams are typically redirected elsewhere.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

/**
 * Sign-in route - public route for user authentication.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: SignInForm,
  beforeLoad: async ({ context }) => {
    // Redirect authenticated users to their appropriate page
    if (context.auth.user) {
      throw redirect({
        to: context.teamContext.hasTeam ? '/leagues' : '/create-team',
        replace: true,
      });
    }
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

/**
 * Sign-up route - public route for user registration.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  component: SignUpForm,
  beforeLoad: async ({ context }) => {
    // Redirect authenticated users to their appropriate page
    if (context.auth.user) {
      throw redirect({
        to: context.teamContext.hasTeam ? '/leagues' : '/create-team',
        replace: true,
      });
    }
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

/**
 * Authenticated layout route - parent route for all routes requiring authentication.
 *
 * Uses {@link requireAuth} guard in
 * {@link https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#beforeload-method | beforeLoad}
 * to redirect unauthenticated users. Child routes automatically inherit auth protection
 * without needing individual guards.
 *
 * **Note:** The underscore prefix (`_authenticated`) is TanStack Router convention for
 * {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#pathless-layout-routes | pathless layout routes}.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const authenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ context }) => {
    await requireAuth(context);
    // Profile is now fetched at root route level and available via context
  },
  component: () => <Outlet />,
});

/**
 * Account route - displays user profile information.
 *
 * Child of {@link authenticatedLayoutRoute}, inherits auth protection.
 * Uses {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading | loader}
 * to fetch profile data before component renders.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const accountRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: 'account',
  loader: async (): Promise<{ userProfile: UserProfile | null }> => {
    const userProfile = await userProfileService.getCurrentProfile();
    return { userProfile };
  },
  component: Account,
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    </div>
  ),
  pendingMs: 200, // Show pending after 200ms to prevent flash for fast loads
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});

/**
 * No-team layout route - parent route for routes requiring no existing team.
 *
 * Uses {@link requireNoTeam} guard in
 * {@link https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#beforeload-method | beforeLoad}
 * to redirect users who already have teams. Child routes automatically inherit this protection.
 *
 * **Note:** The underscore prefix (`_no-team`) is TanStack Router convention for
 * {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#pathless-layout-routes | pathless layout routes}.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const noTeamLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_no-team',
  beforeLoad: async ({ context }) => requireNoTeam(context),
  component: () => <Outlet />,
});

/**
 * Create team route - allows users without teams to create their first team.
 *
 * Child of {@link noTeamLayoutRoute}, inherits protection against users with existing teams.
 * Users who already have a team are automatically redirected to `/leagues`.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const createTeamRoute = createRoute({
  getParentRoute: () => noTeamLayoutRoute,
  path: 'create-team',
  component: CreateTeam,
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading team creation...</p>
      </div>
    </div>
  ),
  pendingMs: 200, // Show pending after 200ms to prevent flash for fast loads
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});

/**
 * Team-required layout route - parent route for all routes requiring a team.
 *
 * Uses {@link requireTeam} guard in
 * {@link https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#beforeload-method | beforeLoad}
 * to redirect users without teams. Child routes automatically inherit team protection
 * without needing individual guards.
 *
 * **Note:** The underscore prefix (`_team-required`) is TanStack Router convention for
 * {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#pathless-layout-routes | pathless layout routes}.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const teamRequiredLayoutRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  id: '_team-required',
  beforeLoad: async ({ context }) => await requireTeam(context),
  component: () => <Outlet />,
});

/**
 * Leagues list route - displays all leagues the user has joined.
 *
 * Child of {@link teamRequiredLayoutRoute}, inherits auth and team protection.
 * Uses {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading | loader}
 * to fetch leagues data before component renders.
 *
 * Implements
 * {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#stale-while-revalidate-caching | SWR caching}
 * with `staleTime` and `gcTime` for optimal performance.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const leaguesRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'leagues',
  loader: async () => {
    const leagues = await getMyLeagues();
    return { leagues };
  },
  component: LeagueList,
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading leagues...</p>
      </div>
    </div>
  ),
  pendingMs: 200, // Show pending after 200ms to prevent flash for fast loads
  staleTime: 10_000, // Consider fresh for 10 seconds
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});

/**
 * League detail route - displays a specific league with leaderboard.
 *
 * Child of {@link teamRequiredLayoutRoute}, inherits auth and team protection.
 * Uses {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading | loader}
 * to fetch league data by ID before component renders.
 *
 * **Note:** Uses Zod schema ({@link leagueIdParamsSchema}) to validate and coerce
 * `leagueId` parameter from string to positive integer with detailed error messages.
 *
 * Implements
 * {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#stale-while-revalidate-caching | SWR caching}
 * with `staleTime` and `gcTime` for optimal performance.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const leagueRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'league/$leagueId',
  loader: async ({ params }) => {
    const LEAGUE_ROUTE_ID = '/_authenticated/_team-required/league/$leagueId';

    // Validate and parse params using Zod schema
    // This automatically coerces string to number and validates constraints
    const validationResult = leagueIdParamsSchema.safeParse(params);

    if (!validationResult.success) {
      // Validation failed - return 404 for invalid league IDs
      throw notFound({ routeId: LEAGUE_ROUTE_ID });
    }

    const { leagueId } = validationResult.data;
    const league = await getLeagueById(leagueId);

    // Return 404 if league doesn't exist
    if (!league) {
      throw notFound({ routeId: LEAGUE_ROUTE_ID });
    }

    return { league };
  },
  component: League,
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading league...</p>
      </div>
    </div>
  ),
  pendingMs: 200, // Show pending after 200ms to prevent flash for fast loads
  staleTime: 10_000, // Consider fresh for 10 seconds
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">League Not Found</h1>
      <p className="text-muted-foreground mb-4">The league you're looking for doesn't exist.</p>
      <a href="/leagues" className="text-primary hover:underline">
        Go to leagues
      </a>
    </div>
  ),
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});

/**
 * Team detail route - displays a specific team with driver/constructor selections.
 *
 * Child of {@link teamRequiredLayoutRoute}, inherits auth and team protection.
 * Uses {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading | loader}
 * to fetch team data by ID before component renders.
 *
 * **Note:** Uses Zod schema ({@link teamIdParamsSchema}) to validate and coerce
 * `teamId` parameter from string to positive integer with detailed error messages.
 *
 * Implements
 * {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#stale-while-revalidate-caching | SWR caching}
 * with `staleTime` and `gcTime` for optimal performance.
 *
 * @type {import('@tanstack/react-router').Route}
 */
const teamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'team/$teamId',
  loader: async ({ params }): Promise<{ team: TeamType }> => {
    const TEAM_ROUTE_ID = '/_authenticated/_team-required/team/$teamId';

    // Validate and parse params using Zod schema
    // This automatically coerces string to number and validates constraints
    const validationResult = teamIdParamsSchema.safeParse(params);

    if (!validationResult.success) {
      // Validation failed - return 404 for invalid team IDs
      throw notFound({ routeId: TEAM_ROUTE_ID });
    }

    const { teamId } = validationResult.data;
    const team = await getTeamById(teamId);

    // Return 404 if team doesn't exist
    if (!team) {
      throw notFound({ routeId: TEAM_ROUTE_ID });
    }

    return { team };
  },
  component: Team,
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    </div>
  ),
  pendingMs: 200, // Show pending after 200ms to prevent flash for fast loads
  staleTime: 10_000, // Consider fresh for 10 seconds
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">Team Not Found</h1>
      <p className="text-muted-foreground mb-4">The team you're looking for doesn't exist.</p>
      <a href="/leagues" className="text-primary hover:underline">
        Go to leagues
      </a>
    </div>
  ),
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});

/**
 * Route tree - hierarchical structure of all application routes.
 *
 * Organized with layout routes for shared logic:
 * - {@link authenticatedLayoutRoute} - auth protection
 * - {@link teamRequiredLayoutRoute} - auth + team protection
 * - {@link noTeamLayoutRoute} - auth + no team protection
 *
 * @type {import('@tanstack/react-router').RootRoute<RouterContext>}
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees | Route Trees}
 */
const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  authenticatedLayoutRoute.addChildren([
    accountRoute,
    teamRequiredLayoutRoute.addChildren([leaguesRoute, leagueRoute, teamRoute]),
  ]),
  noTeamLayoutRoute.addChildren([createTeamRoute]),
]);

/**
 * Router instance - manages application routing with TanStack Router.
 *
 * Configured with:
 * - Route tree structure
 * - Router context (auth, team)
 * - Default pending/error/not-found components
 * - {@link ErrorBoundary} integration for error handling
 *
 * **Note:** Sentry integration is configured in `main.tsx` via
 * `tanStackRouterBrowserTracingIntegration` for performance monitoring.
 *
 * @type {import('@tanstack/react-router').Router<typeof routeTree, 'never'>}
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/api/router/createRouterFunction | createRouter}
 */
export const router = createRouter({
  routeTree,
  context: {
    // Context will be provided by the RouterProvider in main.tsx
    auth: undefined!,
    teamContext: undefined!,
    team: undefined!,
    profile: undefined!,
  },
  defaultPendingComponent: () => (
    <div role="status" className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  ),
  defaultErrorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" />
    </ErrorBoundary>
  ),
  defaultNotFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">404 - Page Not Found</h1>
      <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist.</p>
      <a href="/" className="text-primary hover:underline">
        Go back home
      </a>
    </div>
  ),
});

/**
 * Type registration - enables TypeScript type inference for router.
 *
 * This module augmentation allows TanStack Router to infer types for:
 * - Route paths
 * - Route params
 * - Search params
 * - Loader data
 * - Router context
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/type-safety | Type Safety}
 */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
