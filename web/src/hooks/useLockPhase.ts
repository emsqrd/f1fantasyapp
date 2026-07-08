import { subscribe } from '@/lib/clockTicker';
import { useSyncExternalStore } from 'react';

export type LockPhase = 'open' | 'locked' | 'awaitingResults';

export function computeLockPhase(
  lockDeadline: string | null,
  raceDate: string | null,
  now: number,
): LockPhase {
  if (raceDate != null && now >= Date.parse(raceDate)) return 'awaitingResults';
  if (lockDeadline != null && now >= Date.parse(lockDeadline)) return 'locked';
  return 'open';
}

export function useLockPhase(lockDeadline: string | null, raceDate: string | null): LockPhase {
  return useSyncExternalStore(subscribe, () =>
    computeLockPhase(lockDeadline, raceDate, Date.now()),
  );
}
