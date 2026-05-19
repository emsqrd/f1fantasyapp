import { Account } from '@/components/Account/Account';
import { CreateTeam } from '@/components/CreateTeam/CreateTeam';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorBoundary/ErrorFallback';
import { LandingPage } from '@/components/LandingPage/LandingPage';
import { Layout } from '@/components/Layout/Layout';
import { League } from '@/components/League/League';
import { LeagueList } from '@/components/LeagueList/LeagueList';
import { MyTeamRoute, TeamRoute } from '@/components/Team/Team';
import { ConfirmedNotice } from '@/components/auth/ConfirmedNotice/ConfirmedNotice';
import { SignInForm } from '@/components/auth/SignInForm/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm/SignUpForm';
import type { Team as TeamType } from '@/contracts/Team';
import type { UserProfile } from '@/contracts/UserProfile';
import { readConfirmationLinkError } from '@/lib/auth-redirect';
import { requireAuth, requireNoTeam, requireTeam } from '@/lib/route-guards';
import { type RouterContext, defaultAuthedDestination } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import { getAvailableLeagues, getLeagueById, getMyLeagues } from '@/services/leagueService';
import { getLeagueStandings } from '@/services/standingsService';
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

import { BrowseLeagues } from './components/BrowseLeagues/BrowseLeagues';
import { JoinInvite } from './components/JoinInvite/JoinInvite';
import type { RaceWeekend } from './contracts/RaceWeekend';
import type { Constructor, Driver } from './contracts/Role';
import { getConstructors } from './services/constructorService';
import { getDrivers } from './services/driverService';
import { previewInvite } from './services/leagueInviteService';
import { getRaceWeekends } from './services/raceWeekendService';
import { getCurrentSeason } from './services/seasonService';

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
 * Zod schema for validating redirect search parameters.
 *
 * Uses `.catch()` for graceful error handling per TanStack Router best practices:
 * Invalid redirect values fall back to undefined instead of throwing errors.
 *
 * Security: Only allows internal paths starting with '/' to prevent open redirects.
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/how-to/validate-search-params | Validate Search Parameters}
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
        const [profile, team, currentSeason] = await Promise.all([
          userProfileService.getCurrentProfile(),
          getMyTeam(),
          getCurrentSeason(),
        ]);

        // Sync team ID with TeamContext for components that need it
        context.teamContext.setMyTeamId(team?.id ?? null);

        return { profile, currentSeason };
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

        return { profile: null, currentSeason: null };
      }
    }
    return { profile: null, currentSeason: null };
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

const unauthenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_unauthenticated',
  beforeLoad: ({ context }) => {
    if (context.auth.user) {
      throw redirect({
        to: defaultAuthedDestination(context.teamContext),
        replace: true,
      });
    }
  },
  component: () => <Outlet />,
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
  getParentRoute: () => unauthenticatedLayoutRoute,
  path: '/',
  validateSearch: redirectSearchSchema,
  component: LandingPage,
  beforeLoad: async () => {
    if (await readConfirmationLinkError()) {
      throw redirect({ to: '/sign-up', replace: true });
    }
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

/**
 * Sign-in route - public route for user authentication.
 *
 * @type {import('@tanstack/react-router').Route}
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
 *
 * @type {import('@tanstack/react-router').Route}
 */
const signUpRoute = createRoute({
  getParentRoute: () => unauthenticatedLayoutRoute,
  path: '/sign-up',
  validateSearch: signUpSearchSchema,
  component: SignUpForm,
  beforeLoad: async () => ({ confirmationError: await readConfirmationLinkError() }),
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
});

const authConfirmSearchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.literal('signup').optional(),
  next: z.string().optional().catch(undefined),
});

// Peer of `_unauthenticated` rather than a child: a successful verification
// mints a session, and the unauthenticated layout would redirect signed-in
// users away from this very page.
const authConfirmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/confirm',
  validateSearch: authConfirmSearchSchema,
  component: ConfirmedNotice,
  beforeLoad: async ({ context, search }) => {
    if (!search.token_hash || !search.type) {
      if (context.auth.user) {
        throw redirect({
          to: defaultAuthedDestination(context.teamContext),
          replace: true,
        });
      }
      throw redirect({ to: '/sign-up', replace: true });
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: search.token_hash,
      type: search.type,
    });
    if (error) {
      const confirmationError = error.code === 'otp_expired' ? 'expired' : 'generic';
      throw redirect({
        to: '/sign-up',
        search: { confirmationError },
        replace: true,
      });
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
 *
 * @type {import('@tanstack/react-router').Route}
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
  staticData: {
    pageTitle: 'Account Settings',
  },
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
 *
 * @type {import('@tanstack/react-router').Route}
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
 *
 * @type {import('@tanstack/react-router').Route}
 */
const teamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'team/$teamId',
  staticData: {
    pageTitle: 'Team Details',
  },
  beforeLoad: async ({ context, params }) => {
    // Redirect to /my-team if viewing own team (runs before loader/render)
    const validationResult = teamIdParamsSchema.safeParse(params);
    if (validationResult.success && context.teamContext.myTeamId === validationResult.data.teamId) {
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
    const seasonId = context.currentSeason?.id;

    // Fetch all data in parallel
    const [team, activeDrivers, activeConstructors, races] = await Promise.all([
      getTeamById(teamId),
      getDrivers(),
      getConstructors(),
      seasonId !== undefined ? getRaceWeekends(seasonId) : Promise.resolve([]),
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
    team: TeamType;
    activeDrivers: Driver[];
    activeConstructors: Constructor[];
    races: RaceWeekend[];
  }> => {
    const seasonId = context.currentSeason?.id;

    // Fetch all data in parallel
    const [team, activeDrivers, activeConstructors, races] = await Promise.all([
      getMyTeam(),
      getDrivers(),
      getConstructors(),
      seasonId !== undefined ? getRaceWeekends(seasonId) : Promise.resolve([]),
    ]);

    if (!team) {
      throw redirect({ to: '/create-team' });
    }

    return { team, activeDrivers, activeConstructors, races };
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
 * - {@link noTeamLayoutRoute} - auth + no team protection
 *
 * @type {import('@tanstack/react-router').RootRoute<RouterContext>}
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees | Route Trees}
 */
const routeTree = rootRoute.addChildren([
  unauthenticatedLayoutRoute.addChildren([indexRoute, signInRoute, signUpRoute]),
  authConfirmRoute,
  joinInviteRoute,
  authenticatedLayoutRoute.addChildren([
    accountRoute,
    teamRequiredLayoutRoute.addChildren([
      leaguesRoute,
      browseLeaguesRoute,
      leagueRoute,
      teamRoute,
      myTeamRoute,
    ]),
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
    currentSeason: undefined!,
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
