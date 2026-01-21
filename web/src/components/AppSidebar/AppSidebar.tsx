import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { avatarEvents } from '@/lib/avatarEvents';
import { router } from '@/router';
import { useMatches, useNavigate, useRouterState } from '@tanstack/react-router';
import * as Sentry from '@sentry/react';
import {
  BadgeCheck,
  Check,
  ChevronUpIcon,
  CircleUser,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  PlusIcon,
  SearchIcon,
  Sun,
  TrophyIcon,
  UsersIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
  const { user, signOut, startAuthTransition, completeAuthTransition } = useAuth();
  const { hasTeam, myTeamId } = useTeam();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { isMobile } = useSidebar();

  // Get profile from route context
  const matches = useMatches();
  const rootMatch = matches.find((m) => m.routeId === '__root__');
  const profile = rootMatch?.context?.profile;

  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | undefined>();
  const [isImageLoading, setIsImageLoading] = useState(false);

  const avatarUrl = profile?.avatarUrl || undefined;
  const displayAvatarUrl = uploadedAvatarUrl ?? avatarUrl;

  // Get current pathname for active state
  const currentPath = routerState.location.pathname;

  const handleBrowseLeagues = () => {
    navigate({ to: '/browse-leagues' });
  };

  const handleMyLeagues = () => {
    navigate({ to: '/leagues' });
  };

  const handleMyTeam = () => {
    navigate({ to: '/team/$teamId', params: { teamId: String(myTeamId) } });
  };

  const handleCreateTeam = () => {
    navigate({ to: '/create-team' });
  };

  const handleAccountClick = () => {
    navigate({ to: '/account' });
  };

  const handleSignOut = async () => {
    try {
      startAuthTransition();
      await signOut();

      // Invalidate router cache to prevent stale data fetches with invalid token
      router.invalidate();

      // Navigate to home - auth state change will trigger via onAuthStateChange
      await navigate({ to: '/' });
      completeAuthTransition();
    } catch (error) {
      completeAuthTransition();

      // Log error to Sentry for monitoring
      Sentry.captureException(error, {
        tags: { action: 'sign_out' },
        level: 'error',
        contexts: {
          auth: {
            userId: user?.id,
          },
        },
      });

      // Show user feedback for critical auth failure
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleLogoClick = () => {
    navigate({ to: '/' });
  };

  useEffect(() => {
    if (displayAvatarUrl) {
      setIsImageLoading(true);
    }
  }, [displayAvatarUrl]);

  // Listen for avatar update events
  useEffect(() => {
    const unsubscribe = avatarEvents.subscribe((newAvatarUrl) => {
      setUploadedAvatarUrl(newAvatarUrl);
    });

    return unsubscribe;
  }, []);

  // Define navigation items based on whether user has a team
  const navigationItems = hasTeam
    ? [
        {
          title: 'My Team',
          icon: TrophyIcon,
          onClick: handleMyTeam,
          isActive: currentPath.startsWith('/team/'),
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={displayAvatarUrl}
                      alt="User avatar"
                      onLoad={() => setIsImageLoading(false)}
                      onError={() => setIsImageLoading(false)}
                    />
                    <AvatarFallback className="rounded-lg">
                      <CircleUser className="size-6" />
                    </AvatarFallback>
                    {isImageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{profile?.displayName || 'User'}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                  <ChevronUpIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={displayAvatarUrl}
                        alt="User avatar"
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => setIsImageLoading(false)}
                      />
                      <AvatarFallback className="rounded-lg">
                        <CircleUser className="size-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {profile?.displayName || 'User'}
                      </span>
                      <span className="truncate text-xs">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAccountClick}>
                  <BadgeCheck />
                  My Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 size-4" />
                  Light
                  {theme === 'light' && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 size-4" />
                  Dark
                  {theme === 'dark' && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 size-4" />
                  System
                  {theme === 'system' && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
