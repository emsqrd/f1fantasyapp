import { subscribeClock } from '@/lib/clockTicker';
import { useSyncExternalStore } from 'react';

// Forward-only lifecycle of the current race weekend:
// open (lineup editable) →
// locked (race not yet started) →
// awaitingResults (race started, not yet scored).
export type LineupPhase =
  | {
      phase: 'open';
      remaining: { days: number; hours: number; minutes: number } | null;
      lockingImminently: boolean;
    }
  | { phase: 'locked' }
  | { phase: 'awaitingResults' };

type LineupPhaseSnapshot = 'locked' | 'awaitingResults' | 'open:' | `open:${number}`;

// Returns a plain string so `useSyncExternalStore` re-renders only when the
// displayed value actually changes. `raceDate` is checked before `lockDeadline`
// so awaitingResults wins even without a deadline. The `open:${minutes}` branch
// is only reached while now is before the deadline, so minutes are never negative.
function lineupPhaseSnapshot(
  lockDeadline: string | null,
  raceDate: string | null,
  now: number,
): LineupPhaseSnapshot {
  if (raceDate != null && now >= Date.parse(raceDate)) return 'awaitingResults';
  if (lockDeadline == null) return 'open:';
  if (now >= Date.parse(lockDeadline)) return 'locked';
  return `open:${Math.floor((Date.parse(lockDeadline) - now) / 60_000)}`;
}

function lineupPhaseFromSnapshot(snapshot: LineupPhaseSnapshot): LineupPhase {
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

export function lineupPhase(
  lockDeadline: string | null,
  raceDate: string | null,
  now: number,
): LineupPhase {
  return lineupPhaseFromSnapshot(lineupPhaseSnapshot(lockDeadline, raceDate, now));
}

export function useLineupPhase(lockDeadline: string | null, raceDate: string | null): LineupPhase {
  const snapshot = useSyncExternalStore(subscribeClock, () =>
    lineupPhaseSnapshot(lockDeadline, raceDate, Date.now()),
  );
  return lineupPhaseFromSnapshot(snapshot);
}
