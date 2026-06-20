import type { UserProfile } from '@/contracts/UserProfile';
import { useCurrentAvatar } from '@/hooks/useCurrentAvatar';
import { avatarEvents } from '@/lib/avatarEvents';
import type { RouterContext } from '@/lib/router-context';
import { API_BASE, server } from '@/mocks';
import {
  createAuthedAuth,
  createBaseRouterContext,
  createMockUserProfile,
  renderWithRouter,
} from '@/tests/test-utils';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import { act, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

function AvatarProbe() {
  const { avatarUrl, isLoading, onLoad, onError } = useCurrentAvatar();
  return (
    <div>
      <span data-testid="avatar-url">{avatarUrl ?? '(none)'}</span>
      <span data-testid="loading">{isLoading ? 'loading' : 'idle'}</span>
      <button type="button" onClick={onLoad}>
        load
      </button>
      <button type="button" onClick={onError}>
        error
      </button>
    </div>
  );
}

// The hook reads `profile` from the profile query, so it needs a real router
// (for the QueryClient) and an authenticated user to enable the fetch. Serve the
// profile via MSW the same way production does, and read the hook's output back
// through the probe.
function renderProbe(profile: UserProfile) {
  server.use(http.get(`${API_BASE}/me/profile`, () => HttpResponse.json(profile)));

  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: AvatarProbe,
  });

  return renderWithRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    initialEntry: '/',
    auth: createAuthedAuth(),
    routerContext: createBaseRouterContext(),
  });
}

describe('useCurrentAvatar', () => {
  it('resolves the avatar url from the profile', async () => {
    renderProbe(createMockUserProfile({ avatarUrl: 'https://example.com/me.jpg' }));

    expect(await screen.findByText('https://example.com/me.jpg')).toBeInTheDocument();
  });

  it('treats an empty profile avatar as no avatar', async () => {
    renderProbe(createMockUserProfile({ avatarUrl: '' }));

    expect(await screen.findByTestId('avatar-url')).toHaveTextContent('(none)');
  });

  it('lets an uploaded url override the profile avatar', async () => {
    renderProbe(createMockUserProfile({ avatarUrl: 'https://example.com/me.jpg' }));
    await screen.findByText('https://example.com/me.jpg');

    act(() => avatarEvents.emit('https://example.com/fresh.jpg'));

    expect(screen.getByTestId('avatar-url')).toHaveTextContent('https://example.com/fresh.jpg');
  });

  it('marks loading when the url changes and clears it on load', async () => {
    renderProbe(createMockUserProfile({ avatarUrl: '' }));
    await screen.findByTestId('avatar-url');
    expect(screen.getByTestId('loading')).toHaveTextContent('idle');

    act(() => avatarEvents.emit('https://example.com/fresh.jpg'));
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    await userEvent.click(screen.getByRole('button', { name: 'load' }));
    expect(screen.getByTestId('loading')).toHaveTextContent('idle');
  });

  it('clears loading on image error', async () => {
    renderProbe(createMockUserProfile({ avatarUrl: '' }));
    await screen.findByTestId('avatar-url');

    act(() => avatarEvents.emit('https://example.com/fresh.jpg'));
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    await userEvent.click(screen.getByRole('button', { name: 'error' }));
    expect(screen.getByTestId('loading')).toHaveTextContent('idle');
  });
});
