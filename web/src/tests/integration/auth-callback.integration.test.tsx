import { InlineError } from '@/components/InlineError/InlineError';
import { Button } from '@/components/ui/button';
import { getPostSignupDestination } from '@/lib/auth-destination';
import type { RouterContext } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import {
  buildStubRoute,
  createBaseRouterContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import * as Sentry from '@sentry/react';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  redirect,
} from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Supabase is a third party we don't own — stub its client per the testing
// strategy ("Stub third parties you don't own"). The auth.exchangeCodeForSession
// call talks to Supabase's auth server, not our API, so MSW can't intercept it.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const authCallbackSearchSchema = z.object({
  code: z.string().optional().catch(undefined),
  redirect: z
    .string()
    .refine((url) => url.startsWith('/'), 'Redirect must be an internal path')
    .optional()
    .catch(undefined),
});

// Mirrors `authCallbackRoute` from `router.tsx`. Per the integration-test
// convention, production routes aren't exported so the route under test is
// rebuilt inline — only what the test needs to mount.
function buildAuthCallbackRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const authCallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth/callback',
    validateSearch: authCallbackSearchSchema,
    loaderDeps: ({ search }) => ({ code: search.code, redirect: search.redirect }),
    loader: async ({ deps }) => {
      try {
        if (!deps.code) {
          throw new Error('Missing confirmation code');
        }
        const { error } = await supabase.auth.exchangeCodeForSession(deps.code);
        if (error) throw error;
      } catch (err) {
        const captured = err instanceof Error ? err : new Error('Auth callback failed');
        Sentry.captureException(captured, {
          tags: { component: 'authCallbackRoute', operation: 'exchangeCodeForSession' },
        });
        throw captured;
      }
      throw redirect({ to: getPostSignupDestination(deps.redirect) });
    },
    errorComponent: () => (
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <div className="w-full max-w-md space-y-4">
          <InlineError message="We couldn't confirm your email. The link may have expired or already been used." />
          <div className="text-center">
            <Button variant="link" asChild className="text-sm">
              <Link to="/sign-in">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    ),
  });

  const createTeamStub = buildStubRoute(rootRoute, {
    path: 'create-team',
    heading: 'Create Team',
  });

  const leaguesStub = buildStubRoute(rootRoute, {
    path: 'leagues',
    heading: 'My Leagues',
  });

  const signInStub = buildStubRoute(rootRoute, {
    path: 'sign-in',
    heading: 'Sign In',
  });

  return rootRoute.addChildren([authCallbackRoute, createTeamStub, leaguesStub, signInStub]);
}

describe('/auth/callback', () => {
  const exchangeMock = supabase.auth.exchangeCodeForSession as unknown as MockedFunction<
    typeof supabase.auth.exchangeCodeForSession
  >;
  const captureExceptionMock = Sentry.captureException as unknown as MockedFunction<
    typeof Sentry.captureException
  >;

  beforeEach(() => {
    exchangeMock.mockReset();
    captureExceptionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges the code and lands on /create-team by default', async () => {
    exchangeMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>);

    renderWithRouter({
      routeTree: buildAuthCallbackRouteTree(),
      initialEntry: '/auth/callback?code=abc123',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: /create team/i })).toBeInTheDocument();
    expect(exchangeMock).toHaveBeenCalledWith('abc123');
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('honors the redirect search param when present', async () => {
    exchangeMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>);

    renderWithRouter({
      routeTree: buildAuthCallbackRouteTree(),
      initialEntry: '/auth/callback?code=abc123&redirect=%2Fleagues',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: /my leagues/i })).toBeInTheDocument();
  });

  it('renders the error UI and captures to Sentry when no code is present', async () => {
    renderWithRouter({
      routeTree: buildAuthCallbackRouteTree(),
      initialEntry: '/auth/callback',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't confirm your email/i);
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing confirmation code' }),
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'authCallbackRoute' }),
      }),
    );
  });

  it('renders the error UI and captures to Sentry when supabase returns an error', async () => {
    const supabaseError = new Error('invalid code');
    exchangeMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: supabaseError,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>);

    renderWithRouter({
      routeTree: buildAuthCallbackRouteTree(),
      initialEntry: '/auth/callback?code=abc123',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't confirm your email/i);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      supabaseError,
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'authCallbackRoute' }),
      }),
    );
  });

  it('renders the error UI and captures to Sentry when supabase rejects', async () => {
    const rejection = new Error('network down');
    exchangeMock.mockRejectedValueOnce(rejection);

    renderWithRouter({
      routeTree: buildAuthCallbackRouteTree(),
      initialEntry: '/auth/callback?code=abc123',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't confirm your email/i);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      rejection,
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'authCallbackRoute' }),
      }),
    );
  });
});
