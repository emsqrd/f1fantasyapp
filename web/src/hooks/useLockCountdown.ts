import { subscribe } from '@/lib/clockTicker';
import { useSyncExternalStore } from 'react';

export interface LockCountdown {
  lockingImminently: boolean;
  remaining: { days: number; hours: number; minutes: number } | null;
}

export function useLockCountdown(lockDeadline: string | null): LockCountdown {
  const minutesRemaining = useSyncExternalStore(subscribe, () =>
    lockDeadline == null
      ? null
      : Math.max(0, Math.floor((Date.parse(lockDeadline) - Date.now()) / 60_000)),
  );

  if (minutesRemaining == null) return { lockingImminently: false, remaining: null };

  return {
    lockingImminently: minutesRemaining === 0,
    remaining: {
      days: Math.floor(minutesRemaining / 1440),
      hours: Math.floor((minutesRemaining % 1440) / 60),
      minutes: minutesRemaining % 60,
    },
  };
}
