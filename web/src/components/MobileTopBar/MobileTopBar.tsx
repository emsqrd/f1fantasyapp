import { useCurrentAvatar } from '@/hooks/useCurrentAvatar';
import { Trophy } from 'lucide-react';

import { AccountMenu } from '../AccountMenu/AccountMenu';
import { UserAvatar } from '../UserAvatar/UserAvatar';

export function MobileTopBar() {
  const avatar = useCurrentAvatar();

  return (
    <header className="bg-background sticky top-0 z-40 flex h-13 items-center justify-between border-b px-3.5">
      <div className="flex items-center gap-2">
        <Trophy className="text-primary size-5" />
        <span className="text-base font-bold tracking-[-0.02em]">F1 Fantasy</span>
      </div>
      <AccountMenu
        side="bottom"
        trigger={
          <button type="button" aria-label="Account menu" className="rounded-full p-0.5">
            <UserAvatar {...avatar} className="size-8" />
          </button>
        }
      />
    </header>
  );
}
