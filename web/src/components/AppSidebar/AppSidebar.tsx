import { useAuth } from '@/hooks/useAuth';
import { useCurrentAvatar } from '@/hooks/useCurrentAvatar';
import { useTeam } from '@/hooks/useTeam';
import { useNavigate, useRouteContext, useRouterState } from '@tanstack/react-router';
import { ChevronUpIcon, HomeIcon, PlusIcon, SearchIcon, TrophyIcon, UsersIcon } from 'lucide-react';

import { AccountMenu } from '../AccountMenu/AccountMenu';
import { UserAvatar } from '../UserAvatar/UserAvatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar';

export function AppSidebar() {
  const { user } = useAuth();
  const { hasTeam } = useTeam();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { isMobile, setOpenMobile } = useSidebar();
  const avatar = useCurrentAvatar();

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const { profile } = useRouteContext({ from: '__root__' });

  // Get current pathname for active state
  const currentPath = routerState.location.pathname;

  const handleHome = () => {
    closeOnMobile();
    navigate({ to: '/' });
  };

  const handleBrowseLeagues = () => {
    closeOnMobile();
    navigate({ to: '/browse-leagues' });
  };

  const handleMyLeagues = () => {
    closeOnMobile();
    navigate({ to: '/leagues' });
  };

  const handleMyTeam = () => {
    closeOnMobile();
    navigate({ to: '/my-team' });
  };

  const handleCreateTeam = () => {
    closeOnMobile();
    navigate({ to: '/create-team' });
  };

  const handleLogoClick = () => {
    closeOnMobile();
    navigate({ to: '/' });
  };

  // Define navigation items based on whether user has a team
  const navigationItems = [
    {
      title: 'Home',
      icon: HomeIcon,
      onClick: handleHome,
      isActive: currentPath === '/',
    },
    ...(hasTeam
      ? [
          {
            title: 'My Team',
            icon: TrophyIcon,
            onClick: handleMyTeam,
            isActive: currentPath === '/my-team',
          },
          {
            title: 'My Leagues',
            icon: UsersIcon,
            onClick: handleMyLeagues,
            isActive: currentPath === '/leagues',
          },
          {
            title: 'Browse Leagues',
            icon: SearchIcon,
            onClick: handleBrowseLeagues,
            isActive: currentPath === '/browse-leagues',
          },
        ]
      : [
          {
            title: 'Create Team',
            icon: PlusIcon,
            onClick: handleCreateTeam,
            isActive: currentPath === '/create-team',
          },
        ]),
  ];

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div
          className="flex cursor-pointer items-center gap-2 overflow-hidden px-2 py-2"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleLogoClick();
            }
          }}
          aria-label="Navigate to home page"
        >
          <TrophyIcon className="size-6 shrink-0" />
          <span className="truncate text-lg font-bold group-data-[collapsible=icon]:hidden">
            F1 Fantasy Sports
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={item.onClick}
                    isActive={item.isActive}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu
              side="right"
              onSelect={closeOnMobile}
              trigger={
                <SidebarMenuButton
                  size="lg"
                  aria-label="Account menu"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <UserAvatar {...avatar} />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{profile?.displayName || 'User'}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                  <ChevronUpIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
