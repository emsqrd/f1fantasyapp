import { Layout } from '@/components/Layout/Layout';
import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import type { UserProfile } from '@/contracts/UserProfile';
import type { RouterContext } from '@/lib/router-context';
import { setMobileViewport } from '@/setupTests';
import {
  buildStubRoute,
  createAuthedAuth,
  createBaseRouterContext,
  createMockUserProfile,
  createTeamContext,
  renderWithRouter,
} from '@/tests/test-utils';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  // Radix's menu primitives reach for pointer-capture and scroll APIs that
  // jsdom doesn't implement; stub the missing ones so the account dropdown opens.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

// `useNavDestinations` reads team presence from the React `TeamContext`, not
// router context, so it must wrap the root component as production does.
function buildNavRouteTree(teamContextValue: TeamContextType) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <TeamContext.Provider value={teamContextValue}>
        <Layout />
      </TeamContext.Provider>
    ),
  });

  return rootRoute.addChildren([
    buildStubRoute(rootRoute, { path: '/', heading: 'Home Page' }),
    buildStubRoute(rootRoute, { path: 'my-team', heading: 'My Team Page' }),
    buildStubRoute(rootRoute, { path: 'leagues', heading: 'Leagues Page' }),
    buildStubRoute(rootRoute, { path: 'browse-leagues', heading: 'Browse Page' }),
  ]);
}

function renderNav(options: {
  hasTeam: boolean;
  mobile: boolean;
  initialEntry?: string;
  profile?: UserProfile | null;
}) {
  setMobileViewport(options.mobile);

  const teamContext = createTeamContext(options.hasTeam ? { myTeamId: 1, hasTeam: true } : {});

  return renderWithRouter({
    routeTree: buildNavRouteTree(teamContext),
    initialEntry: options.initialEntry ?? '/',
    auth: createAuthedAuth(),
    routerContext: createBaseRouterContext({
      teamContext,
      profile: options.profile ?? createMockUserProfile(),
    }),
  });
}

describe('Navigation shell', () => {
  it('renders the bottom-bar destinations and top bar on a phone viewport', async () => {
    renderNav({ hasTeam: true, mobile: true });

    const bottomNav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(bottomNav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Team' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Leagues' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Browse' })).toBeInTheDocument();

    expect(screen.getByText('F1 Fantasy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /toggle sidebar/i })).not.toBeInTheDocument();
    expect(screen.queryByText('F1 Fantasy Sports')).not.toBeInTheDocument();
  });

  it('shows only Home in the bottom bar when the user has no team', async () => {
    renderNav({ hasTeam: false, mobile: true });

    const bottomNav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(bottomNav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(bottomNav).queryByRole('link', { name: 'Team' })).not.toBeInTheDocument();
    expect(within(bottomNav).queryByRole('link', { name: 'Leagues' })).not.toBeInTheDocument();
    expect(within(bottomNav).queryByRole('link', { name: 'Browse' })).not.toBeInTheDocument();
  });

  it('marks the active destination in the bottom bar from the current route', async () => {
    renderNav({ hasTeam: true, mobile: true, initialEntry: '/leagues' });

    const bottomNav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(bottomNav).getByRole('link', { name: 'Leagues' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(bottomNav).getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('opens the account menu from the top-bar avatar', async () => {
    const user = userEvent.setup();
    renderNav({
      hasTeam: true,
      mobile: true,
      profile: createMockUserProfile({ displayName: 'Ada Lovelace' }),
    });

    await user.click(await screen.findByRole('button', { name: 'Account menu' }));

    expect(await screen.findByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('renders the desktop sidebar and no mobile bars on a wide viewport', async () => {
    renderNav({ hasTeam: true, mobile: false });

    expect(await screen.findByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
    expect(screen.getByText('F1 Fantasy Sports')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByText('F1 Fantasy')).not.toBeInTheDocument();
  });

  it('maps the nav destinations onto the desktop sidebar and marks the active route', async () => {
    renderNav({ hasTeam: true, mobile: false, initialEntry: '/leagues' });

    expect(await screen.findByRole('link', { name: 'My Team' })).toHaveAttribute(
      'href',
      '/my-team',
    );
    expect(screen.getByRole('link', { name: 'My Leagues' })).toHaveAttribute('href', '/leagues');
    expect(screen.getByRole('link', { name: 'Browse Leagues' })).toHaveAttribute(
      'href',
      '/browse-leagues',
    );

    // `SidebarMenuButton` drives its active styling off `data-active`, set from
    // the sidebar's exact `useMatchRoute({ to })`.
    expect(screen.getByRole('link', { name: 'My Leagues' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('data-active', 'false');
  });
});
