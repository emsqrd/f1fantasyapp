import { Account } from '@/components/Account/Account';
import { CreateTeam } from '@/components/CreateTeam/CreateTeam';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { IndexRoute } from '@/components/IndexRoute/IndexRoute';
import { Layout } from '@/components/Layout/Layout';
import { League } from '@/components/League/League';
import { LeagueList } from '@/components/LeagueList/LeagueList';
import { MyTeamRoute, TeamRoute } from '@/components/Team/Team';
import { ConfirmEmailNotice } from '@/components/auth/ConfirmEmailNotice/ConfirmEmailNotice';
import { SignInForm } from '@/components/auth/SignInForm/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm/SignUpForm';
import type { Team as TeamType } from '@/contracts/Team';
import { requireAuth, requireTeam } from '@/lib/route-guards';
import type { RouterContext } from '@/lib/router-context';
import { getAvailableLeagues, getLeagueById, getMyLeagues } from '@/services/leagueService';
import { getLeagueStandings, getMyStandings } from '@/services/standingsService';
import { getTeamById, getTeamSummary, myTeamQuery } from '@/services/teamService';
import { profileQuery } from '@/services/userProfileService';
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

import { BrowseLeagues } from './components/BrowseLeagues/BrowseLeagues';
import { JoinInvite } from './components/JoinInvite/JoinInvite';
import type { RaceWeekend } from './contracts/RaceWeekend';
import type { Constructor, Driver } from './contracts/Role';
import { routerAuth } from './lib/authStore';
import { queryClient } from './lib/queryClient';
import { getConstructors } from './services/constructorService';
import { getDrivers } from './services/driverService';
import { previewInvite } from './services/leagueInviteService';
import { getRaceWeekends } from './services/raceWeekendService';
import { seasonQuery } from './services/seasonService';

/**
 * Zod schema for validating league ID route parameter.
 *
 * Ensures leagueId is:
 * - Coerced from string to number
 * - An integer
 * - A positive value (> 0)
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
 */
const teamIdParamsSchema = z.object({
  teamId: z.coerce
    .number({ message: 'Team ID must be a number' })
    .int('Team ID must be an integer')
    .positive('Team ID must be positive'),
});

/**
 * Zod schema for validating redirect search parameters.
 *
 * Uses `.catch()` for graceful error handling per TanStack Router best practices:
 * Invalid redirect values fall back to undefined instead of throwing errors.
 *
 * Security: Only allows internal paths starting with '/' to prevent open redirects.
 */
const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .refine((url) => url.startsWith('/'), 'Redirect must be an internal path')
    .optional()
    .catch(undefined),
});

/**
 * Root route with context - wraps all routes in the application.
 *
 * Provides the base layout with {@link Layout} component and dev tools.
 * All child routes inherit context containing auth and the query client.
 */
const rootRoute = createRootRouteWithContext<RouterContext>()({
  loader: async ({ context }) => {
    // Prime the profile query so the app shell and the index greeting serve it
    // from cache. Tolerate a failure — a profile blip must not fail the whole tree.
    if (context.auth.user) {
      await context.queryClient.ensureQueryData(profileQuery).catch(() => null);
    }
  },
  component: () => (
    <>
      <Layout />
      {import.meta.env.VITE_ROUTER_DEVTOOLS === 'true' && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
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

const unauthenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_unauthenticated',
  beforeLoad: ({ context }) => {
    if (context.auth.user) {
      throw redirect({
        to: '/',
        replace: true,
      });
    }
  },
  component: () => <Outlet />,
});

/**
 * Index route at `/` - branches on auth state.
 *
 * Anonymous users see the marketing {@link LandingPage}. Authenticated users see
 * the {@link Home} surface composed from team summary, league standings, and
 * race weekends fetched in parallel by the loader.
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: redirectSearchSchema,
  loader: async ({ context }) => {
    if (!context.auth.user) {
      return { home: null };
    }

    const season = await context.queryClient.ensureQueryData(seasonQuery);

    const [summary, standings, races] = await Promise.all([
      getTeamSummary(),
      getMyStandings(),
      season ? getRaceWeekends(season.id) : Promise.resolve([]),
    ]);

    return { home: { summary, standings, races } };
  },
  component: IndexRoute,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

/**
 * Sign-in route - public route for user authentication.
 */
const signInRoute = createRoute({
  getParentRoute: () => unauthenticatedLayoutRoute,
  path: '/sign-in',
  validateSearch: redirectSearchSchema,
  component: SignInForm,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

const signUpSearchSchema = redirectSearchSchema.extend({
  confirmationError: z.enum(['expired', 'generic']).optional().catch(undefined),
});

/**
 * Sign-up route - public route for user registration.
 */
const signUpRoute = createRoute({
  getParentRoute: () => unauthenticatedLayoutRoute,
  path: '/sign-up',
  validateSearch: signUpSearchSchema,
  component: SignUpForm,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

const authConfirmSearchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.literal('signup').optional(),
  next: z.string().optional().catch(undefined),
});

// Not under the `_unauthenticated` layout, which redirects signed-in users
// away: a re-clicked or back-navigated confirmation link must still reach
// this route, since the user is already signed in by then.
const authConfirmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/confirm',
  validateSearch: authConfirmSearchSchema,
  component: ConfirmEmailNotice,
  beforeLoad: ({ context, search }) => {
    if (!search.token_hash || !search.type) {
      if (context.auth.user) {
        throw redirect({
          to: '/',
          replace: true,
        });
      }
      throw redirect({ to: '/sign-up', replace: true });
    }
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

/**
 * Join invite route - public route for previewing and joining leagues via invite link.
 *
 * Displays league information from an invite token and allows users to join.
 * Uses {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading | loader}
 * to fetch and validate invite preview before component renders.
 *
 * **Note:** Returns 404 for invalid or expired tokens. Users can be authenticated or
 * unauthenticated - authentication is handled by the {@link JoinInvite} component.
 */
const joinInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/join/$token',
  staticData: {
    pageTitle: 'Join League',
  },
  component: JoinInvite,
  loader: async ({ params }) => {
    const ROUTE_ID = '/join/$token';
    const { token } = params;

    try {
      const preview = await previewInvite(token);
      return { preview };
    } catch (_) {
      // invalid or non-existent token returns 404
      throw notFound({ routeId: ROUTE_ID });
    }
  },
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading invite details...</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
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
 */
const authenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: ({ context }) => requireAuth(context),
  component: () => <Outlet />,
  // Catches the `requireTeam` fetch failure thrown by the `_team-required`
  // child guard. Placed on this ancestor — inside the root Layout outlet, so the
  // chrome stays and the user gets a retry — because a route's own errorComponent
  // doesn't reliably catch its own beforeLoad throw on a hard load.
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} onReset={reset} level="page" />
    </ErrorBoundary>
  ),
});

/**
 * Account route - displays user profile information.
 *
 * Child of {@link authenticatedLayoutRoute}, inherits auth protection.
 * Uses {@link https://tanstack.com/router/latest/docs/framework/react/guide/data-loading | loader}
 * to fetch profile data before component renders.
 */
const accountRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: 'account',
  staticData: {
    pageTitle: 'Account Settings',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(profileQuery);
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
 * Create team route - lets an authenticated user create their team.
 */
const createTeamRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: 'create-team',
  validateSearch: redirectSearchSchema,
  staticData: {
    pageTitle: 'Create Team',
  },
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
 */
const teamRequiredLayoutRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  id: '_team-required',
  beforeLoad: ({ context }) => requireTeam(context),
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
 */
const leaguesRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'leagues',
  staticData: {
    pageTitle: 'My Leagues',
  },
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
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});

const browseLeaguesRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'browse-leagues',
  staticData: {
    pageTitle: 'Available Leagues',
  },
  loader: async () => {
    const leagues = await getAvailableLeagues();
    return { leagues };
  },
  component: BrowseLeagues,
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
 */
const leagueRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'league/$leagueId',
  staticData: {
    pageTitle: 'League Details',
  },
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
    const [league, standings] = await Promise.all([
      getLeagueById(leagueId),
      getLeagueStandings(leagueId),
    ]);

    // Return 404 if either resource is missing — the two endpoints should agree,
    // but a defensive check here prevents a runtime crash inside the component.
    if (!league || !standings) {
      throw notFound({ routeId: LEAGUE_ROUTE_ID });
    }

    return { league, standings };
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
 */
const teamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'team/$teamId',
  staticData: {
    pageTitle: 'Team Details',
  },
  beforeLoad: async ({ context, params }) => {
    // Redirect to /my-team if viewing own team (runs before loader/render).
    const validationResult = teamIdParamsSchema.safeParse(params);
    if (!validationResult.success) return;

    const team = await context.queryClient.ensureQueryData(myTeamQuery);
    if (team?.id === validationResult.data.teamId) {
      throw redirect({ to: '/my-team', replace: true });
    }
  },
  loader: async ({
    params,
    context,
  }): Promise<{
    team: TeamType;
    activeDrivers: Driver[];
    activeConstructors: Constructor[];
    races: RaceWeekend[];
  }> => {
    const TEAM_ROUTE_ID = '/_authenticated/_team-required/team/$teamId';

    // Validate and parse params using Zod schema
    // This automatically coerces string to number and validates constraints
    const validationResult = teamIdParamsSchema.safeParse(params);

    if (!validationResult.success) {
      // Validation failed - return 404 for invalid team IDs
      throw notFound({ routeId: TEAM_ROUTE_ID });
    }

    const { teamId } = validationResult.data;
    const season = await context.queryClient.ensureQueryData(seasonQuery);

    // Fetch all data in parallel
    const [team, activeDrivers, activeConstructors, races] = await Promise.all([
      getTeamById(teamId),
      getDrivers(),
      getConstructors(),
      season ? getRaceWeekends(season.id) : Promise.resolve([]),
    ]);

    // Return 404 if team doesn't exist
    if (!team) {
      throw notFound({ routeId: TEAM_ROUTE_ID });
    }

    return { team, activeDrivers, activeConstructors, races };
  },
  component: TeamRoute,
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

const myTeamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'my-team',
  staticData: {
    pageTitle: 'My Team',
  },
  loader: async ({
    context,
  }): Promise<{
    activeDrivers: Driver[];
    activeConstructors: Constructor[];
    races: RaceWeekend[];
  }> => {
    const season = await context.queryClient.ensureQueryData(seasonQuery);
    // Warm-cache hit after the `_team-required` guard; pairs with the component's
    // useSuspenseQuery(myTeamQuery).
    await context.queryClient.ensureQueryData(myTeamQuery);

    const [activeDrivers, activeConstructors, races] = await Promise.all([
      getDrivers(),
      getConstructors(),
      season ? getRaceWeekends(season.id) : Promise.resolve([]),
    ]);

    return { activeDrivers, activeConstructors, races };
  },
  component: MyTeamRoute,
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
      <p className="text-muted-foreground mb-4">Your team could not be found.</p>
      <a href="/create-team" className="text-primary hover:underline">
        Create Team
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
 */
const routeTree = rootRoute.addChildren([
  indexRoute,
  unauthenticatedLayoutRoute.addChildren([signInRoute, signUpRoute]),
  authConfirmRoute,
  joinInviteRoute,
  authenticatedLayoutRoute.addChildren([
    accountRoute,
    createTeamRoute,
    teamRequiredLayoutRoute.addChildren([
      leaguesRoute,
      browseLeaguesRoute,
      leagueRoute,
      teamRoute,
      myTeamRoute,
    ]),
  ]),
]);

/**
 * Router instance - manages application routing with TanStack Router.
 *
 * Configured with:
 * - Route tree structure
 * - Router context (auth, queryClient)
 * - Default pending/error/not-found components
 * - {@link ErrorBoundary} integration for error handling
 *
 * **Note:** Sentry integration is configured in `main.tsx` via
 * `tanStackRouterBrowserTracingIntegration` for performance monitoring.
 */
export const router = createRouter({
  routeTree,
  context: {
    auth: routerAuth,
    queryClient,
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
 */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
