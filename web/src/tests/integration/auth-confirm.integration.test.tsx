import { ConfirmEmailNotice } from '@/components/auth/ConfirmEmailNotice/ConfirmEmailNotice';
import type { RouterContext } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import {
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
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

  const signUpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-up',
    validateSearch: signUpStubSearchSchema,
    component: SignUpStub,
  });

  const homeRoute = buildStubRoute(rootRoute, {
    path: '/',
    heading: 'Home Stub',
  });
  const joinInviteRoute = buildStubRoute(rootRoute, {
    path: '/join/$token',
    heading: 'Join Invite Stub',
  });

  return rootRoute.addChildren([authConfirmRoute, signUpRoute, homeRoute, joinInviteRoute]);
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

  it('verifies the token on the Continue click and navigates to / after verification', async () => {
    mockVerifyOtpSuccess();
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=abc123&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: /confirm your email/i })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'abc123',
      type: 'signup',
    });
    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
  });

  it('navigates to the same-origin next param, overriding the default', async () => {
    mockVerifyOtpSuccess();
    const user = userEvent.setup();

    const sameOriginNext = `${window.location.origin}/join/abc`;
    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: `/auth/confirm?token_hash=abc123&type=signup&next=${encodeURIComponent(
        sameOriginNext,
      )}`,
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Join Invite Stub' })).toBeInTheDocument();
  });

  it('redirects to /sign-up?confirmationError=expired when verifyOtp errors with otp_expired', async () => {
    mockVerifyOtpError('otp_expired');
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=stale&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Sign-up Stub' })).toBeInTheDocument();
    expect(await screen.findByTestId('confirmation-error')).toHaveTextContent('expired');
  });

  it('redirects to /sign-up?confirmationError=generic when verifyOtp errors with any other code', async () => {
    mockVerifyOtpError('some_other_error');
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=stale&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /continue/i }));

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

  it('redirects a signed-in visitor with no token_hash to /', async () => {
    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('ignores a cross-origin next value and falls back to the default', async () => {
    mockVerifyOtpSuccess();
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: `/auth/confirm?token_hash=abc123&type=signup&next=${encodeURIComponent(
        'https://evil.example.com/foo',
      )}`,
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
  });

  it('does not verify the token on page load — only on the Continue click', async () => {
    mockVerifyOtpSuccess();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=abc123&type=signup',
      auth: createUnauthAuth(),
      routerContext: createBaseRouterContext(),
    });

    expect(await screen.findByRole('heading', { name: /confirm your email/i })).toBeInTheDocument();

    await expect(
      waitFor(
        () => {
          expect(supabase.auth.verifyOtp).toHaveBeenCalled();
        },
        { timeout: 200 },
      ),
    ).rejects.toBeTruthy();

    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /confirm your email/i })).toBeInTheDocument();
  });

  it('skips verifyOtp for an already signed-in visitor and navigates straight through', async () => {
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildAuthConfirmRouteTree(),
      initialEntry: '/auth/confirm?token_hash=abc123&type=signup',
      auth: createAuthedAuth(),
      routerContext: createBaseRouterContext(),
    });

    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
