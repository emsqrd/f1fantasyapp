import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm/ForgotPasswordForm';
import { supabase } from '@/lib/supabase';
import {
  buildRootRoute,
  buildStubRoute,
  buildUnauthenticatedLayout,
  createAuthedAuth,
  createUnauthAuth,
  renderWithRouter,
} from '@/tests/test-utils';
import * as Sentry from '@sentry/react';
import { AuthApiError } from '@supabase/supabase-js';
import { createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const forgotPasswordSearchSchema = z.object({
  error: z.enum(['expired']).optional().catch(undefined),
});

function buildForgotPasswordRouteTree() {
  const rootRoute = buildRootRoute();
  const unauthLayout = buildUnauthenticatedLayout(rootRoute);

  const forgotPasswordRoute = createRoute({
    getParentRoute: () => unauthLayout,
    path: '/forgot-password',
    validateSearch: forgotPasswordSearchSchema,
    component: ForgotPasswordForm,
  });

  const signInRoute = buildStubRoute(rootRoute, { path: '/sign-in', heading: 'Sign-in Stub' });
  const homeRoute = buildStubRoute(rootRoute, { path: '/', heading: 'Home Stub' });

  return rootRoute.addChildren([
    unauthLayout.addChildren([forgotPasswordRoute]),
    signInRoute,
    homeRoute,
  ]);
}

describe('/forgot-password route', () => {
  afterEach(() => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReset();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('sends a reset email for the typed address and shows the check-email state', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null });
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

  it('shows the expired-link banner when arriving with ?error=expired', async () => {
    renderWithRouter({
      routeTree: buildForgotPasswordRouteTree(),
      initialEntry: '/forgot-password?error=expired',
      auth: createUnauthAuth(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer valid/i);
  });

  it('renders the expired-link banner for a signed-in user without bouncing home', async () => {
    renderWithRouter({
      routeTree: buildForgotPasswordRouteTree(),
      initialEntry: '/forgot-password?error=expired',
      auth: createAuthedAuth(),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer valid/i);
    expect(screen.queryByRole('heading', { name: 'Home Stub' })).not.toBeInTheDocument();
  });
});
