import { cn } from '@/lib/utils';
import { CircleUser, Loader2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface UserAvatarProps {
  avatarUrl?: string;
  isLoading?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
}

export function UserAvatar({ avatarUrl, isLoading, onLoad, onError, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-8 rounded-lg', className)}>
      <AvatarImage src={avatarUrl} alt="User avatar" onLoad={onLoad} onError={onError} />
      <AvatarFallback className="rounded-lg">
        <CircleUser className="size-6" />
      </AvatarFallback>
      {isLoading && (
        <div
          role="status"
          aria-label="Loading avatar"
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50"
        >
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
    </Avatar>
  );
}
