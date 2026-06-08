import { AccountMenu } from '@/components/AccountMenu/AccountMenu';
import type { AuthContextType } from '@/contexts/AuthContext';
import type { UserProfile } from '@/contracts/UserProfile';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/setupTests';
import {
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import * as Sentry from '@sentry/react';
import type { User } from '@supabase/supabase-js';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { ThemeProvider } from 'next-themes';
import { toast } from 'sonner';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Sentry's ESM namespace can't be spied on directly; stub the one method the
// sign-out failure path reports through (a third party we don't own).
vi.mock('@sentry/react', async (importActual) => ({
  ...(await importActual<typeof import('@sentry/react')>()),
  captureException: vi.fn(),
}));

beforeAll(() => {
  // Radix's menu primitives reach for pointer-capture and scroll APIs that
  // jsdom doesn't implement; stub the missing ones so the real dropdown opens.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.className = '';
});

// Mount the real `AccountMenu` in a route-tree root so it stays present across
// navigation, with stub `/` and `/account` destinations to land on. Profile and
// auth flow through the router context exactly as in production.
function buildMenuTree(withTheme = false) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => {
      const body = (
        <>
          <AccountMenu side="bottom" trigger={<button type="button">Open account menu</button>} />
          <Outlet />
        </>
      );
      return withTheme ? (
        <ThemeProvider attribute="class" enableSystem={false} defaultTheme="light">
          {body}
        </ThemeProvider>
      ) : (
        body
      );
    },
  });

  return rootRoute.addChildren([
    buildStubRoute(rootRoute, { path: '/', heading: 'Home' }),
    buildStubRoute(rootRoute, { path: 'account', heading: 'Account Page' }),
  ]);
}

function renderMenu(options: {
  auth: AuthContextType;
  initialEntry?: string;
  withTheme?: boolean;
  profile?: UserProfile | null;
}) {
  const profile = options.profile ?? createMockUserProfile();
  server.use(http.get(`${API_BASE}/me/profile`, () => HttpResponse.json(profile)));

  return renderWithRouter({
    routeTree: buildMenuTree(options.withTheme),
    initialEntry: options.initialEntry ?? '/',
    auth: options.auth,
    routerContext: createBaseRouterContext(),
  });
}

describe('Account menu', () => {
  it('opens to reveal the signed-in identity', async () => {
    const user = userEvent.setup();
    renderMenu({
      auth: createAuthedAuth({ user: { id: 'user-123', email: 'ada@example.com' } as User }),
      profile: createMockUserProfile({ displayName: 'Ada Lovelace' }),
    });

    await user.click(await screen.findByRole('button', { name: 'Open account menu' }));

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('navigates to the account page from My Account', async () => {
    const user = userEvent.setup();
    renderMenu({ auth: createAuthedAuth(), initialEntry: '/' });

    await user.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'My Account' }));

    expect(await screen.findByRole('heading', { name: 'Account Page' })).toBeInTheDocument();
  });

  it('signs out and returns home on success', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockResolvedValue(undefined);
    const startAuthTransition = vi.fn();
    const completeAuthTransition = vi.fn();

    renderMenu({
      auth: createAuthedAuth({ signOut, startAuthTransition, completeAuthTransition }),
      initialEntry: '/account',
    });

    await screen.findByRole('heading', { name: 'Account Page' });
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign Out' }));

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(startAuthTransition).toHaveBeenCalledTimes(1);
    expect(completeAuthTransition).toHaveBeenCalledTimes(1);
  });

  it('reports a failed sign out and stays put', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockRejectedValue(new Error('sign out failed'));
    const completeAuthTransition = vi.fn();
    const captureException = vi.mocked(Sentry.captureException);
    const toastError = vi.spyOn(toast, 'error').mockReturnValue('toast-id');

    renderMenu({
      auth: createAuthedAuth({ signOut, completeAuthTransition }),
      initialEntry: '/account',
    });

    await screen.findByRole('heading', { name: 'Account Page' });
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign Out' }));

    await waitFor(() => expect(completeAuthTransition).toHaveBeenCalledTimes(1));
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { action: 'sign_out' } }),
    );
    expect(toastError).toHaveBeenCalledWith('Failed to sign out. Please try again.');
    expect(screen.getByRole('heading', { name: 'Account Page' })).toBeInTheDocument();
  });

  it('applies the chosen theme to the document', async () => {
    const user = userEvent.setup();
    renderMenu({ auth: createAuthedAuth(), withTheme: true });

    await user.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });
});
