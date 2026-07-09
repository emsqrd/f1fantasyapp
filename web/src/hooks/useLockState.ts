import { subscribe } from '@/lib/clockTicker';
import { useSyncExternalStore } from 'react';

export type LockState =
  | {
      phase: 'open';
      remaining: { days: number; hours: number; minutes: number } | null;
      lockingImminently: boolean;
    }
  | { phase: 'locked' }
  | { phase: 'awaitingResults' };

// Returns a plain string so `useSyncExternalStore` re-renders only when the
// displayed value actually changes. `raceDate` is checked before `lockDeadline`
// so awaitingResults wins even without a deadline. The `open:${minutes}` branch
// is only reached while now is before the deadline, so minutes are never negative.
function computeSnapshot(
  lockDeadline: string | null,
  raceDate: string | null,
  now: number,
): string {
  if (raceDate != null && now >= Date.parse(raceDate)) return 'awaitingResults';
  if (lockDeadline == null) return 'open:';
  if (now >= Date.parse(lockDeadline)) return 'locked';
  return `open:${Math.floor((Date.parse(lockDeadline) - now) / 60_000)}`;
}

function parseSnapshot(snapshot: string): LockState {
  if (snapshot === 'awaitingResults') return { phase: 'awaitingResults' };
  if (snapshot === 'locked') return { phase: 'locked' };

  const minutes = snapshot === 'open:' ? null : Number(snapshot.slice('open:'.length));
  if (minutes == null) return { phase: 'open', remaining: null, lockingImminently: false };

  return {
    phase: 'open',
    remaining: {
      days: Math.floor(minutes / 1440),
      hours: Math.floor((minutes % 1440) / 60),
      minutes: minutes % 60,
    },
    lockingImminently: minutes === 0,
  };
}

export function computeLockState(
  lockDeadline: string | null,
  raceDate: string | null,
  now: number,
): LockState {
  return parseSnapshot(computeSnapshot(lockDeadline, raceDate, now));
}

export function useLockState(lockDeadline: string | null, raceDate: string | null): LockState {
  const snapshot = useSyncExternalStore(subscribe, () =>
    computeSnapshot(lockDeadline, raceDate, Date.now()),
  );
  return parseSnapshot(snapshot);
}
