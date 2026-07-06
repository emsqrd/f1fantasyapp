import { useAuth } from '@/hooks/useAuth';
import { useCurrentAvatar } from '@/hooks/useCurrentAvatar';
import { useNavDestinations } from '@/hooks/useNavDestinations';
import { profileQueries } from '@/services/userProfileService';
import { useQuery } from '@tanstack/react-query';
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { ChevronUpIcon, TrophyIcon } from 'lucide-react';

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
} from '../ui/sidebar';

export function AppSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const destinations = useNavDestinations();
  const avatar = useCurrentAvatar();

  const { data: profile } = useQuery({ ...profileQueries.current(), enabled: !!user });

  const handleLogoClick = () => {
    void navigate({ to: '/' });
  };

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
              {destinations.map((dest) => (
                <SidebarMenuItem key={dest.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={!!matchRoute({ to: dest.to })}
                    tooltip={dest.title}
                  >
                    <Link to={dest.to}>
                      <dest.icon />
                      <span>{dest.title}</span>
                    </Link>
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
