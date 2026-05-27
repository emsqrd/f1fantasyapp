import type { RaceWeekend } from '@/contracts/RaceWeekend';
import { useLockCountdown } from '@/hooks/useLockCountdown';
import { Calendar, Lock, MapPin } from 'lucide-react';

interface NextRaceCardProps {
  races: RaceWeekend[];
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

function formatRaceDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
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

export function NextRaceCard({ races }: NextRaceCardProps) {
  const currentRace = races.find((r) => r.isCurrent) ?? null;

  if (currentRace === null) {
    const finalRace = races.at(-1) ?? null;
    return (
      <section className="bg-card rounded-[0.65rem] border p-4 md:p-6">
        <p className="text-muted-foreground text-sm">
          Season complete
          {finalRace && (
            <>
              {' · Final race: '}
              <span className="text-foreground font-semibold">{finalRace.name}</span>
              {', '}
              {formatRaceDate(finalRace.raceDate)}
            </>
          )}
        </p>
      </section>
    );
  }

  return <NextRaceCardActive race={currentRace} />;
}

function NextRaceCardActive({ race }: { race: RaceWeekend }) {
  const { isLocked, lockingImminently, lockDeadline, remaining } = useLockCountdown(
    race.lockDeadline,
  );

  return (
    <section className="bg-card rounded-[0.65rem] border p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-[color-mix(in_oklab,var(--primary)_70%,var(--muted-foreground))] uppercase">
            Round {race.round} <span aria-hidden="true">·</span> Next up
          </p>
          <h2 className="text-foreground truncate text-2xl font-bold tracking-tight md:text-3xl">
            {race.name}
          </h2>
          <div className="text-muted-foreground mt-1 flex flex-col gap-y-1 text-xs md:flex-row md:items-center md:gap-x-3 md:text-sm">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {race.circuit.location}, {race.circuit.country}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden="true" />
              {formatRaceDate(race.raceDate)}
            </span>
          </div>
        </div>

        {lockDeadline && (
          <div className="border-border border-t pt-4 md:border-t-0 md:pt-0 md:text-right">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              {isLocked ? 'Lineup' : 'Lineup locks in'}
            </p>
            {isLocked ? (
              <div className="text-muted-foreground mt-1 flex items-center gap-1.5 md:justify-end">
                <Lock className="size-4" aria-hidden="true" />
                <span className="text-base font-semibold">Lineup Locked</span>
              </div>
            ) : lockingImminently ? (
              <p className="mt-1 text-base font-semibold">Less than 1 minute</p>
            ) : (
              remaining && (
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums md:text-3xl">
                  <TimeSegment value={remaining.days} unit="d" />{' '}
                  <TimeSegment value={remaining.hours} unit="h" pad />{' '}
                  <TimeSegment value={remaining.minutes} unit="m" pad />
                </p>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
