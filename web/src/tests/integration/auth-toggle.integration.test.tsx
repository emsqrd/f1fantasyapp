import { SignInForm } from '@/components/auth/SignInForm/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm/SignUpForm';
import type { RouterContext } from '@/lib/router-context';
import { safeInternalPath } from '@/lib/safeInternalPath';
import { buildUnauthenticatedLayout, createUnauthAuth, renderWithRouter } from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// SignInForm/SignUpForm call useSearch({ from: '/_unauthenticated/sign-in' }),
// so both routes must sit under the `_unauthenticated` layout at these exact
// paths or the forms throw on render.
const redirectSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined).transform(safeInternalPath),
});

const signUpSearchSchema = redirectSearchSchema.extend({
  confirmationError: z.enum(['expired', 'generic']).optional().catch(undefined),
});

function buildAuthToggleRouteTree() {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const unauthenticatedLayoutRoute = buildUnauthenticatedLayout(rootRoute);

  const signInRoute = createRoute({
    getParentRoute: () => unauthenticatedLayoutRoute,
    path: '/sign-in',
    validateSearch: redirectSearchSchema,
    component: SignInForm,
  });

  const signUpRoute = createRoute({
    getParentRoute: () => unauthenticatedLayoutRoute,
    path: '/sign-up',
    validateSearch: signUpSearchSchema,
    component: SignUpForm,
  });

  return rootRoute.addChildren([
    unauthenticatedLayoutRoute.addChildren([signInRoute, signUpRoute]),
  ]);
}

describe('sign-in ↔ sign-up toggle', () => {
  it('carries redirect from sign-in to sign-up', async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter({
      routeTree: buildAuthToggleRouteTree(),
      initialEntry: '/sign-in?redirect=/league/5',
      auth: createUnauthAuth(),
    });

    await user.click(await screen.findByRole('link', { name: /sign up/i }));

    expect(await screen.findByLabelText(/display name/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-up');
    expect((router.state.location.search as { redirect?: string }).redirect).toBe('/league/5');
  });

  it('carries redirect from sign-up to sign-in', async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter({
      routeTree: buildAuthToggleRouteTree(),
      initialEntry: '/sign-up?redirect=/league/5',
      auth: createUnauthAuth(),
    });

    await user.click(await screen.findByRole('link', { name: /sign in/i }));

    expect(
      await screen.findByText(/sign in to access your f1 fantasy league/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect((router.state.location.search as { redirect?: string }).redirect).toBe('/league/5');
  });
});
