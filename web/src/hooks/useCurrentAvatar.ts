import { avatarEvents } from '@/lib/avatarEvents';
import { useRouteContext } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export interface CurrentAvatar {
  avatarUrl: string | undefined;
  isLoading: boolean;
  onLoad: () => void;
  onError: () => void;
}

/**
 * Layers an uploaded avatar (broadcast via `avatarEvents`) over the profile on
 * the root route context, so a just-uploaded image shows before the route
 * reloads. `isLoading` tracks the decode of a newly-changed URL.
 */
export function useCurrentAvatar(): CurrentAvatar {
  const { profile } = useRouteContext({ from: '__root__' });

  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const profileAvatarUrl = profile?.avatarUrl || undefined;
  const avatarUrl = uploadedAvatarUrl ?? profileAvatarUrl;

  const [prevAvatarUrl, setPrevAvatarUrl] = useState(avatarUrl);
  if (avatarUrl !== prevAvatarUrl) {
    setPrevAvatarUrl(avatarUrl);
    if (avatarUrl) {
      setIsLoading(true);
    }
  }

  useEffect(() => {
    return avatarEvents.subscribe((newAvatarUrl) => {
      setUploadedAvatarUrl(newAvatarUrl);
    });
  }, []);

  const onLoad = () => setIsLoading(false);
  const onError = () => setIsLoading(false);

  return { avatarUrl, isLoading, onLoad, onError };
}
