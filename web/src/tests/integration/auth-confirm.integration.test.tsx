import { ConfirmedNotice } from '@/components/auth/ConfirmedNotice/ConfirmedNotice';
import { type RouterContext, defaultAuthedDestination } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import {
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
  createTeamContext,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import { AuthApiError } from '@supabase/supabase-js';
import {
  ErrorComponent,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  redirect,
  useSearch,
} from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
    },
  },
}));

const authConfirmSearchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.literal('signup').optional(),
  next: z.string().optional().catch(undefined),
});

const signUpStubSearchSchema = z.object({
  confirmationError: z.enum(['expired', 'generic']).optional().catch(undefined),
});

function SignUpStub() {
  const search = useSearch({ strict: false }) as { confirmationError?: string };
  return (
    <>
      <h1>Sign-up Stub</h1>
      {search.confirmationError && (
        <p data-testid="confirmation-error">{search.confirmationError}</p>
      )}
    </>
  );
}

function buildAuthConfirmRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

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
      if (context.auth.user) return;
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

  const signUpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-up',
    validateSearch: signUpStubSearchSchema,
    component: SignUpStub,
  });

  const leaguesRoute = buildStubRoute(rootRoute, {
    path: '/leagues',
    heading: 'Leagues Stub',
  });
  const createTeamRoute = buildStubRoute(rootRoute, {
    path: '/create-team',
    heading: 'Create Team Stub',
  });
  const joinInviteRoute = buildStubRoute(rootRoute, {
    path: '/join/$token',
    heading: 'Join Invite Stub',
  });

  return rootRoute.addChildren([
    authConfirmRoute,
    signUpRoute,
    leaguesRoute,
    createTeamRoute,
    joinInviteRoute,
  ]);
}

function mockVerifyOtpSuccess() {
  vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
}

function mockVerifyOtpError(code: string) {
  vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
    data: { user: null, session: null },
    error: new AuthApiError(code, 400, code),
  });
}

describe('/auth/confirm route', () => {
  afterEach(() => {
    vi.mocked(supabase.auth.verifyOtp).mockReset();
  });

  it('calls verifyOtp, renders ConfirmedNotice, and navigates to /create-team when the user has no team', async () => {
    mockVerifyOtpSuccess();
    const teamContext = createTeamContext({ hasTeam: false });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=abc123&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'abc123',
      type: 'signup',
    });
    expect(screen.getAllByRole('button', { name: /continue/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Create Team Stub' })).toBeInTheDocument();
  });

  it('skips verifyOtp when the user is already signed in with a valid token_hash (idempotent re-entry)', async () => {
    const teamContext = createTeamContext({ hasTeam: false });

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=abc123&type=signup',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('navigates to the same-origin next param, overriding the team-state default', async () => {
    mockVerifyOtpSuccess();
    const teamContext = createTeamContext({ myTeamId: 1, hasTeam: true });
    const user = userEvent.setup();

    const sameOriginNext = `${window.location.origin}/join/abc`;
    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: `/auth/confirm?token_hash=abc123&type=signup&next=${encodeURIComponent(
        sameOriginNext,
      )}`,
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Join Invite Stub' })).toBeInTheDocument();
  });

  it('redirects to /sign-up?confirmationError=expired when verifyOtp errors with otp_expired', async () => {
    mockVerifyOtpError('otp_expired');

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=stale&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Sign-up Stub' })).toBeInTheDocument();
    expect(await screen.findByTestId('confirmation-error')).toHaveTextContent('expired');
  });

  it('redirects to /sign-up?confirmationError=generic when verifyOtp errors with any other code', async () => {
    mockVerifyOtpError('some_other_error');

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=stale&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Sign-up Stub' })).toBeInTheDocument();
    expect(await screen.findByTestId('confirmation-error')).toHaveTextContent('generic');
  });

  it('redirects a signed-out visitor with no token_hash to /sign-up', async () => {
    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Sign-up Stub' })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('redirects a signed-in visitor with a team and no token_hash to /leagues', async () => {
    const teamContext = createTeamContext({ myTeamId: 1, hasTeam: true });

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: 'Leagues Stub' })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('ignores a cross-origin next value and falls back to the team-state default', async () => {
    mockVerifyOtpSuccess();
    const teamContext = createTeamContext({ myTeamId: 1, hasTeam: true });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: `/auth/confirm?token_hash=abc123&type=signup&next=${encodeURIComponent(
        'https://evil.example.com/foo',
      )}`,
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Leagues Stub' })).toBeInTheDocument();
  });

  it('does not navigate away from ConfirmedNotice without a Continue click', async () => {
    mockVerifyOtpSuccess();
    const teamContext = createTeamContext({ hasTeam: false });

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=abc123&type=signup',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext({ teamContext }),
    });

    expect(await screen.findByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();

    await expect(
      waitFor(
        () => {
          expect(
            screen.queryByRole('heading', { name: /email confirmed/i }),
          ).not.toBeInTheDocument();
        },
        { timeout: 200 },
      ),
    ).rejects.toBeTruthy();

    expect(screen.getByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Team Stub' })).not.toBeInTheDocument();
  });
});
