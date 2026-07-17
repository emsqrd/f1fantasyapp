import { Layout } from '@/components/Layout/Layout';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm/ResetPasswordForm';
import { seedAuthStore } from '@/lib/authStore';
import { redirectIfAuthenticated } from '@/lib/route-guards';
import { supabase } from '@/lib/supabase';
import { supabaseRecovery } from '@/lib/supabaseRecovery';
import {
  buildRootRoute,
  buildStubRoute,
  buildUnauthenticatedLayout,
  createAuthedAuth,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import * as Sentry from '@sentry/react';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { createRoute } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      setSession: vi.fn(),
    },
  },
}));

vi.mock('@/lib/supabaseRecovery', () => ({
  supabaseRecovery: {
    auth: {
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

function buildForgotPasswordRoute(parent: ReturnType<typeof buildUnauthenticatedLayout>) {
  return createRoute({
    getParentRoute: () => parent,
    path: '/forgot-password',
    beforeLoad: ({ context }) => redirectIfAuthenticated(context),
    component: ForgotPasswordForm,
  });
}

function buildForgotPasswordRouteTree() {
  const rootRoute = buildRootRoute();
  const unauthLayout = buildUnauthenticatedLayout(rootRoute);

  const forgotPasswordRoute = buildForgotPasswordRoute(unauthLayout);
  const signInRoute = buildStubRoute(rootRoute, { path: '/sign-in', heading: 'Sign-in Stub' });
  const homeRoute = buildStubRoute(rootRoute, { path: '/', heading: 'Home Stub' });

  return rootRoute.addChildren([
    unauthLayout.addChildren([forgotPasswordRoute]),
    signInRoute,
    homeRoute,
  ]);
}

const resetPasswordSearchSchema = z.object({
  token_hash: z.string().optional().catch(undefined),
  type: z.literal('recovery').optional().catch(undefined),
});

/**
 * Pass `rootComponent: Layout` to mount the route under the real `Layout` — the
 * only way to see the remount the `publicShell` flag exists to prevent.
 */
function buildResetPasswordRouteTree({ rootComponent }: { rootComponent?: () => ReactNode } = {}) {
  const rootRoute = buildRootRoute({ component: rootComponent });
  const unauthLayout = buildUnauthenticatedLayout(rootRoute);

  const resetPasswordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reset-password',
    validateSearch: resetPasswordSearchSchema,
    staticData: {
      publicShell: true,
    },
    component: ResetPasswordForm,
  });

  const forgotPasswordRoute = buildForgotPasswordRoute(unauthLayout);
  const homeRoute = buildStubRoute(rootRoute, { path: '/', heading: 'Home Stub' });

  return rootRoute.addChildren([
    resetPasswordRoute,
    unauthLayout.addChildren([forgotPasswordRoute]),
    homeRoute,
  ]);
}

const RECOVERY_ENTRY = '/reset-password?token_hash=recovery-token&type=recovery';

function mockVerifyOtpSuccess() {
  vi.mocked(supabaseRecovery.auth.verifyOtp).mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
}

function mockUpdateUserSuccess() {
  vi.mocked(supabaseRecovery.auth.updateUser).mockResolvedValue({
    data: { user: {} },
    error: null,
  } as Awaited<ReturnType<typeof supabaseRecovery.auth.updateUser>>);
  vi.mocked(supabaseRecovery.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'access-token', refresh_token: 'refresh-token' } },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabaseRecovery.auth.getSession>>);
  vi.mocked(supabaseRecovery.auth.signOut).mockResolvedValue({ error: null });
  vi.mocked(supabase.auth.setSession).mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
}

async function submitNewPassword(
  user: ReturnType<typeof userEvent.setup>,
  {
    password = 'newpassword123',
    confirmation = password,
  }: { password?: string; confirmation?: string } = {},
) {
  await user.type(await screen.findByLabelText(/new password/i), password);
  await user.type(screen.getByLabelText(/confirm password/i), confirmation);
  await user.click(screen.getByRole('button', { name: /update password/i }));
}

describe('/forgot-password route', () => {
  afterEach(() => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReset();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('sends a reset email for the typed address and shows the check-email state', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildForgotPasswordRouteTree(),
      initialEntry: '/forgot-password',
      auth: createUnauthAuth(),
    });

    await user.type(await screen.findByLabelText(/email/i), 'racer@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('racer@example.com');
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText('racer@example.com')).toBeInTheDocument();
  });

  it('shows the identical check-email state and captures nothing when the send is rate-limited', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: null,
      error: new AuthApiError('over_email_send_rate_limit', 429, 'over_email_send_rate_limit'),
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildForgotPasswordRouteTree(),
      initialEntry: '/forgot-password',
      auth: createUnauthAuth(),
    });

    await user.type(await screen.findByLabelText(/email/i), 'racer@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText('racer@example.com')).toBeInTheDocument();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('still shows the check-email state but captures unexpected send failures', async () => {
    const unexpected = new Error('network down');
    vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValue(unexpected);
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildForgotPasswordRouteTree(),
      initialEntry: '/forgot-password',
      auth: createUnauthAuth(),
    });

    await user.type(await screen.findByLabelText(/email/i), 'racer@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledWith(unexpected, {
      tags: { component: 'ForgotPasswordForm', operation: 'sendPasswordResetEmail' },
    });
  });

  it('bounces a signed-in visitor home', async () => {
    renderWithRouter({
      routeTree: buildForgotPasswordRouteTree(),
      initialEntry: '/forgot-password',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();
  });
});

describe('/reset-password route', () => {
  afterEach(() => {
    vi.mocked(supabaseRecovery.auth.verifyOtp).mockReset();
    vi.mocked(supabaseRecovery.auth.updateUser).mockReset();
    vi.mocked(supabaseRecovery.auth.getSession).mockReset();
    vi.mocked(supabaseRecovery.auth.signOut).mockReset();
    vi.mocked(supabase.auth.setSession).mockReset();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('leaves the token unspent on page load', async () => {
    mockVerifyOtpSuccess();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();

    await expect(
      waitFor(
        () => {
          expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalled();
        },
        { timeout: 200 },
      ),
    ).rejects.toBeTruthy();
  });

  it('shows the unusable-link notice in place when the link carried no token', async () => {
    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: '/reset-password',
      auth: createUnauthAuth(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't use that reset link/i);
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(supabaseRecovery.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('shows the same notice, not the error boundary, when the link carries the wrong type', async () => {
    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: '/reset-password?token_hash=recovery-token&type=signup',
      auth: createUnauthAuth(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't use that reset link/i);
    expect(supabaseRecovery.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('verifies the token, updates the password, and lands on home', async () => {
    mockVerifyOtpSuccess();
    mockUpdateUserSuccess();
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'recovery-token',
      type: 'recovery',
    });
    expect(supabaseRecovery.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpassword123',
    });
    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
  });

  it('signs the user in only once the password change succeeds', async () => {
    mockVerifyOtpSuccess();
    mockUpdateUserSuccess();
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(supabaseRecovery.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('leaves the recovery session out of the default client when the password change fails', async () => {
    mockVerifyOtpSuccess();
    vi.mocked(supabaseRecovery.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('New password is too weak', 422, 'weak_password'),
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/new password is too weak/i);
    // Reopening the app must not restore a signed-in session for a password that
    // never changed.
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('replaces the form with the unusable-link notice when the token no longer verifies', async () => {
    vi.mocked(supabaseRecovery.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Email link is invalid or has expired', 403, 'otp_expired'),
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't use that reset link/i);
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Home Stub' })).not.toBeInTheDocument();
    expect(supabaseRecovery.auth.updateUser).not.toHaveBeenCalled();

    await user.click(screen.getByRole('link', { name: /request a new link/i }));

    expect(await screen.findByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('keeps the form for a retry and reports the failure when verification hits a transient error', async () => {
    const transientError = new AuthRetryableFetchError('Failed to fetch', 0);
    vi.mocked(supabaseRecovery.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: transientError,
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't verify your reset link/i);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't use that reset link/i)).not.toBeInTheDocument();
    expect(supabaseRecovery.auth.updateUser).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(transientError, {
      tags: { component: 'ResetPasswordForm', operation: 'verifyRecoveryToken' },
    });

    // The token was never spent, so a retry can verify it and finish.
    mockVerifyOtpSuccess();
    mockUpdateUserSuccess();
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalledTimes(2);
  });

  it('keeps the form and captures when verification fails with an unexpected server error', async () => {
    vi.mocked(supabaseRecovery.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Internal server error', 500, undefined),
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't verify your reset link/i);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't use that reset link/i)).not.toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('retries a rejected password against the session the spent token already created', async () => {
    mockVerifyOtpSuccess();
    vi.mocked(supabaseRecovery.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('New password is too weak', 422, 'weak_password'),
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/new password is too weak/i);

    mockUpdateUserSuccess();
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalledOnce();
    expect(supabaseRecovery.auth.updateUser).toHaveBeenCalledTimes(2);
  });

  it('spends the token once when the button is double-clicked mid-verify', async () => {
    let releaseVerify!: () => void;
    vi.mocked(supabaseRecovery.auth.verifyOtp).mockReturnValue(
      new Promise((resolve) => {
        releaseVerify = () => resolve({ data: { user: null, session: null }, error: null });
      }),
    );
    mockUpdateUserSuccess();
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await user.type(await screen.findByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');

    const submit = screen.getByRole('button', { name: /update password/i });
    await user.click(submit);
    await user.click(submit);

    expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalledOnce();

    releaseVerify();

    expect(await screen.findByRole('heading', { name: 'Home Stub' })).toBeInTheDocument();
    expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalledOnce();
    expect(supabaseRecovery.auth.updateUser).toHaveBeenCalledOnce();
  });

  it('shows an error and verifies nothing when the passwords do not match', async () => {
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user, { password: 'password123', confirmation: 'password124' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(supabaseRecovery.auth.verifyOtp).not.toHaveBeenCalled();
    expect(supabaseRecovery.auth.updateUser).not.toHaveBeenCalled();
  });

  it('shows an error and verifies nothing when the password is too short', async () => {
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree(),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user, { password: '123' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /password must be at least 6 characters/i,
    );
    expect(supabaseRecovery.auth.verifyOtp).not.toHaveBeenCalled();
    expect(supabaseRecovery.auth.updateUser).not.toHaveBeenCalled();
  });

  it('keeps the form mounted under the real Layout when the store picks up a session mid-flow', async () => {
    // The store can acknowledge a session while the form still holds state,
    // e.g. another tab signing in mid-retry. Layout must hold the public
    // header: switching to the sidebar re-parents the Outlet, remounting the
    // form and dropping both the typed passwords and the record that the
    // token was already spent.
    mockVerifyOtpSuccess();
    vi.mocked(supabaseRecovery.auth.updateUser).mockImplementationOnce(() => {
      seedAuthStore(createAuthedAuth());
      return Promise.resolve({
        data: { user: null },
        error: new AuthApiError('New password is too weak', 422, 'weak_password'),
      });
    });
    const user = userEvent.setup();

    renderWithRouter({
      routeTree: buildResetPasswordRouteTree({ rootComponent: Layout }),
      initialEntry: RECOVERY_ENTRY,
      auth: createUnauthAuth(),
    });

    await submitNewPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/new password is too weak/i);
    expect(screen.getByLabelText(/new password/i)).toHaveValue('newpassword123');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

    mockUpdateUserSuccess();
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(supabaseRecovery.auth.updateUser).toHaveBeenCalledTimes(2);
    });
    expect(supabaseRecovery.auth.verifyOtp).toHaveBeenCalledOnce();
  });
});
