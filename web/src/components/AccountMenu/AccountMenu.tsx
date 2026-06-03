import { useAuth } from '@/hooks/useAuth';
import { useCurrentAvatar } from '@/hooks/useCurrentAvatar';
import * as Sentry from '@sentry/react';
import { useNavigate, useRouteContext, useRouter } from '@tanstack/react-router';
import { BadgeCheck, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '../UserAvatar/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

interface AccountMenuProps {
  /** The element that opens the menu, rendered via Radix `asChild`. */
  trigger: ReactNode;
  side: 'right' | 'bottom';
}

export function AccountMenu({ trigger, side }: AccountMenuProps) {
  const { user, signOut, startAuthTransition, completeAuthTransition } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const router = useRouter();
  const avatar = useCurrentAvatar();

  const { profile } = useRouteContext({ from: '__root__' });

  const handleAccountClick = () => {
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
        className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
        side={side}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserAvatar {...avatar} className="size-9" />
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
        <DropdownMenuLabel className="text-muted-foreground px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={setTheme}
          className="flex gap-1 px-1 pb-1"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              // Keep the menu open on change so the segmented active state stays visible.
              onSelect={(event) => event.preventDefault()}
              className="text-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary flex-1 flex-col gap-1 rounded-md border px-1 py-2 text-[11px] font-semibold [&>span:first-child]:hidden"
            >
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
