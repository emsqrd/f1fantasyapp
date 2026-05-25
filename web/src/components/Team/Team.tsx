import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import type { Team } from '@/contracts/Team';
import { useLockCountdown } from '@/hooks/useLockCountdown';
import { formatBudget } from '@/lib/utils';
import { setCaptain } from '@/services/teamService';
import { useLoaderData } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useState } from 'react';

import { AppContainer } from '../AppContainer/AppContainer';
import { ConstructorPicker } from '../ConstructorPicker/ConstructorPicker';
import { DriverPicker } from '../DriverPicker/DriverPicker';
import { InlineError } from '../InlineError/InlineError';

export interface TeamViewProps {
  team: Team;
  activeDrivers: Driver[];
  activeConstructors: Constructor[];
  races: RaceWeekend[];
  readOnly: boolean;
}

export function MyTeamRoute() {
  const { team, activeDrivers, activeConstructors, races } = useLoaderData({
    from: '/_authenticated/_team-required/my-team',
  });

  return (
    <TeamView
      team={team}
      activeDrivers={activeDrivers}
      activeConstructors={activeConstructors}
      races={races}
      readOnly={false}
    />
  );
}

export function TeamRoute() {
  const { team, activeDrivers, activeConstructors, races } = useLoaderData({
    from: '/_authenticated/_team-required/team/$teamId',
  });

  return (
    <TeamView
      team={team}
      activeDrivers={activeDrivers}
      activeConstructors={activeConstructors}
      races={races}
      readOnly={true}
    />
  );
}

export function TeamView({
  team,
  activeDrivers,
  activeConstructors,
  races,
  readOnly,
}: TeamViewProps) {
  const [captainDriverId, setCaptainDriverId] = useState<number | null>(
    team.drivers.find((d) => d.isCaptain)?.id ?? null,
  );
  const [captainError, setCaptainError] = useState<string | null>(null);
  const currentRace = races.find((r) => r.isCurrent) ?? races.at(-1);

  const { isLocked, lockingImminently, lockDeadline, remaining } = useLockCountdown(
    currentRace?.lockDeadline ?? null,
  );

  const handleSetCaptain = async (driverId: number | null) => {
    const previous = captainDriverId;
    setCaptainDriverId(driverId);
    setCaptainError(null);
    try {
      await setCaptain(driverId);
    } catch (error) {
      setCaptainDriverId(previous);
      setCaptainError(error instanceof Error ? error.message : 'Failed to update captain');
    }
  };

  return (
    <AppContainer maxWidth="md">
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {readOnly && <span className="text-muted-foreground text-sm">{team.ownerName}</span>}
        </div>
        {currentRace && (
          <p className="text-muted-foreground text-sm">
            Round {currentRace.round} · {currentRace.name}
          </p>
        )}
      </div>

      <div className="bg-background sticky top-0 z-10 mb-6 flex flex-wrap items-start justify-between gap-y-3 border-b py-3 sm:flex-nowrap">
        <div className="flex gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Remaining
            </p>
            <p className="text-sm font-bold">{formatBudget(team.remainingBudget)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Transfers
            </p>
            <p className="text-sm font-bold">3/3</p>
          </div>
        </div>
        {lockDeadline && (
          <div className="w-full sm:w-auto sm:shrink-0 sm:text-right">
            {isLocked ? (
              <>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Lineup
                </p>
                <div className="text-muted-foreground flex items-center justify-center gap-1.5">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm font-medium">Lineup Locked</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Lineup Locks In
                </p>
                {lockingImminently ? (
                  <p className="text-sm font-medium">Less than 1 minute</p>
                ) : (
                  remaining && (
                    <p className="text-sm font-bold">
                      {remaining.days}d {String(remaining.hours).padStart(2, '0')}h{' '}
                      {String(remaining.minutes).padStart(2, '0')}m
                    </p>
                  )
                )}
              </>
            )}
          </div>
        )}
      </div>

      {captainError && (
        <div className="pb-4">
          <InlineError message={captainError} />
        </div>
      )}
      <div className="space-y-8">
        <DriverPicker
          activeDrivers={activeDrivers}
          teamDrivers={team.drivers}
          readOnly={readOnly || isLocked}
          remainingBudget={team.remainingBudget}
          captainDriverId={captainDriverId}
          onSetCaptain={readOnly || isLocked ? undefined : handleSetCaptain}
        />
        <ConstructorPicker
          activeConstructors={activeConstructors}
          teamConstructors={team.constructors}
          readOnly={readOnly || isLocked}
          remainingBudget={team.remainingBudget}
        />
      </div>
    </AppContainer>
  );
}
