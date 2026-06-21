import { SignUpForm } from '@/components/auth/SignUpForm/SignUpForm';
import type { RouterContext } from '@/lib/router-context';
import { safeInternalPath } from '@/lib/safeInternalPath';
import { supabase } from '@/lib/supabase';
import { buildUnauthenticatedLayout, createUnauthAuth, renderWithRouter } from '@/tests/test-utils';
import { AuthApiError } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
    },
  },
}));

// Mirrors the `/sign-up` route from `router.tsx`.
const signUpSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined).transform(safeInternalPath),
  confirmationError: z.enum(['expired', 'generic']).optional().catch(undefined),
});

function buildSignUpRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const unauthenticatedLayoutRoute = buildUnauthenticatedLayout(rootRoute);

  const signUpRoute = createRoute({
    getParentRoute: () => unauthenticatedLayoutRoute,
    path: '/sign-up',
    validateSearch: signUpSearchSchema,
    component: SignUpForm,
  });

  return rootRoute.addChildren([unauthenticatedLayoutRoute.addChildren([signUpRoute])]);
}

async function driveFormToPending(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/display name/i), 'Test User');
  await user.type(screen.getByLabelText(/email/i), 'pending@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'password123');
  await user.type(screen.getByLabelText(/confirm password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign up/i }));
  await screen.findByRole('heading', { name: /check your email/i });
}

describe('Signup resend confirmation', () => {
  afterEach(() => {
    vi.mocked(supabase.auth.resend).mockReset();
  });

  it('passes the form email and redirect-aware emailRedirectTo through to supabase.auth.resend', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ session: null });
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    renderWithRouter({
      routeTree: buildSignUpRouteTree(),
      initialEntry: '/sign-up?redirect=/leagues/123',
      auth: createUnauthAuth({ signUp }),
    });

    await driveFormToPending(user);
    await user.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'pending@example.com',
        options: { emailRedirectTo: `${window.location.origin}/leagues/123` },
      });
    });
  });

  it('renders the friendly rate-limit message when supabase.auth.resend returns over_email_send_rate_limit', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ session: null });
    const rateLimitError = new AuthApiError('rate limit', 429, 'over_email_send_rate_limit');
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: { user: null, session: null },
      error: rateLimitError,
    });

    renderWithRouter({
      routeTree: buildSignUpRouteTree(),
      initialEntry: '/sign-up?redirect=/leagues/123',
      auth: createUnauthAuth({ signUp }),
    });

    await driveFormToPending(user);
    await user.click(screen.getByRole('button', { name: /resend/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You've sent too many confirmation requests. Please try again later.",
    );
  });
});
