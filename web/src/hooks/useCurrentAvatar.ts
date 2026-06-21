import { useAuth } from '@/hooks/useAuth';
import { avatarEvents } from '@/lib/avatarEvents';
import { profileQueries } from '@/services/userProfileService';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export interface CurrentAvatar {
  avatarUrl: string | undefined;
  isLoading: boolean;
  onLoad: () => void;
  onError: () => void;
}

/**
 * Layers an uploaded avatar (broadcast via `avatarEvents`) over the profile
 * query, so a just-uploaded image shows before the query refetches. `isLoading`
 * tracks the decode of a newly-changed URL.
 */
export function useCurrentAvatar(): CurrentAvatar {
  const { user } = useAuth();
  const { data: profile } = useQuery({ ...profileQueries.current(), enabled: !!user });

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
