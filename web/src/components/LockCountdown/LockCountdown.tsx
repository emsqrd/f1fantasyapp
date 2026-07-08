import {
  type LockCountdown as LockCountdownState,
  useLockCountdown,
} from '@/hooks/useLockCountdown';
import type { LockPhase } from '@/hooks/useLockPhase';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

interface LockCountdownProps {
  phase: LockPhase;
  lockDeadline: string | null;
  variant?: 'hero' | 'compact';
  className?: string;
}

const variantStyles = {
  hero: {
    label: 'tracking-[0.18em]',
    statusText: 'text-base font-semibold',
    lockedRow: 'mt-1 flex items-center gap-1.5 md:justify-end',
    imminent: 'mt-1 text-base font-semibold',
    countdown: 'mt-1 font-mono text-2xl font-bold tabular-nums md:text-3xl',
  },
  compact: {
    label: 'tracking-wider',
    statusText: 'text-sm font-medium',
    lockedRow: 'flex items-center justify-center gap-1.5',
    imminent: 'text-sm font-medium',
    countdown: 'text-sm font-bold',
  },
};

export function LockCountdown({
  phase,
  lockDeadline,
  variant = 'compact',
  className,
}: LockCountdownProps) {
  const { lockingImminently, remaining } = useLockCountdown(lockDeadline);
  const v = variantStyles[variant];

  // Once the race has run there's no lock to count down or announce.
  if (phase === 'awaitingResults') return null;

  if (!lockDeadline) return null;

  return (
    <div className={className}>
      <p className={cn('text-muted-foreground text-xs font-medium uppercase', v.label)}>
        {phase === 'locked' ? 'Lineup' : 'Lineup locks in'}
      </p>
      {phase === 'locked' ? (
        <div className={cn('text-muted-foreground', v.lockedRow)}>
          <Lock className="size-4" aria-hidden="true" />
          <span className={v.statusText}>Lineup Locked</span>
        </div>
      ) : lockingImminently ? (
        <p className={v.imminent}>Less than 1 minute</p>
      ) : (
        remaining && (
          <CountdownValue remaining={remaining} variant={variant} className={v.countdown} />
        )
      )}
    </div>
  );
}

function CountdownValue({
  remaining,
  variant,
  className,
}: {
  remaining: NonNullable<LockCountdownState['remaining']>;
  variant: 'hero' | 'compact';
  className?: string;
}) {
  const { days, hours, minutes } = remaining;

  return (
    <p className={className}>
      <span className="sr-only">{spokenDuration(days, hours, minutes)}</span>
      <span aria-hidden="true">
        {variant === 'hero' ? (
          <>
            <TimeSegment value={days} unit="d" pad /> <TimeSegment value={hours} unit="h" pad />{' '}
            <TimeSegment value={minutes} unit="m" pad />
          </>
        ) : (
          <>
            {String(days).padStart(2, '0')}d {String(hours).padStart(2, '0')}h{' '}
            {String(minutes).padStart(2, '0')}m
          </>
        )}
      </span>
    </p>
  );
}

function spokenDuration(days: number, hours: number, minutes: number): string {
  const part = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;
  return `${part(days, 'day')}, ${part(hours, 'hour')}, ${part(minutes, 'minute')}`;
}

interface TimeSegmentProps {
  value: number;
  unit: 'd' | 'h' | 'm';
  pad?: boolean;
}

function TimeSegment({ value, unit, pad = false }: TimeSegmentProps) {
  const display = pad ? String(value).padStart(2, '0') : String(value);
  return (
    <span>
      {display}
      <span className="text-muted-foreground ml-0.5 text-sm font-semibold md:text-base">
        {unit}
      </span>
    </span>
  );
}
