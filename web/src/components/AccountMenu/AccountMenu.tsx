import { useAuth } from '@/hooks/useAuth';
import { useCurrentAvatar } from '@/hooks/useCurrentAvatar';
import * as Sentry from '@sentry/react';
import { useNavigate, useRouteContext, useRouter } from '@tanstack/react-router';
import { BadgeCheck, Check, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '../UserAvatar/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface AccountMenuProps {
  /** The element that opens the menu, rendered via Radix `asChild`. */
  trigger: ReactNode;
  side: 'right' | 'bottom';
  onSelect?: () => void;
}

export function AccountMenu({ trigger, side, onSelect }: AccountMenuProps) {
  const { user, signOut, startAuthTransition, completeAuthTransition } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const router = useRouter();
  const avatar = useCurrentAvatar();

  const { profile } = useRouteContext({ from: '__root__' });

  const handleAccountClick = () => {
    onSelect?.();
    navigate({ to: '/account' });
  };

  const handleSignOut = async () => {
    try {
      startAuthTransition();
      await signOut();

      // Invalidate router cache to prevent stale data fetches with invalid token
      router.invalidate();

      // Auth state change propagates via onAuthStateChange
      await navigate({ to: '/' });
      completeAuthTransition();
    } catch (error) {
      completeAuthTransition();

      Sentry.captureException(error, {
        tags: { action: 'sign_out' },
        level: 'error',
        contexts: {
          auth: {
            userId: user?.id,
          },
        },
      });

      toast.error('Failed to sign out. Please try again.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side={side}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserAvatar {...avatar} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{profile?.displayName || 'User'}</span>
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
  );
}
