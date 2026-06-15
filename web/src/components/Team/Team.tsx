import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Constructor, Driver } from '@/contracts/Role';
import type { Team } from '@/contracts/Team';
import { useLockCountdown } from '@/hooks/useLockCountdown';
import { useSetCaptain } from '@/hooks/useSetCaptain';
import { formatBudget } from '@/lib/utils';
import { constructorsQuery } from '@/services/constructorService';
import { driversQuery } from '@/services/driverService';
import { myTeamQuery } from '@/services/teamService';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound, useLoaderData } from '@tanstack/react-router';

import { AppContainer } from '../AppContainer/AppContainer';
import { ConstructorPicker } from '../ConstructorPicker/ConstructorPicker';
import { DriverPicker } from '../DriverPicker/DriverPicker';
import { InlineError } from '../InlineError/InlineError';
import { LockCountdown } from '../LockCountdown/LockCountdown';

export interface TeamViewProps {
  team: Team;
  activeDrivers: Driver[];
  activeConstructors: Constructor[];
  races: RaceWeekend[];
  readOnly: boolean;
}

export function MyTeamRoute() {
  const { data: team } = useSuspenseQuery(myTeamQuery);
  const { data: activeDrivers } = useSuspenseQuery(driversQuery);
  const { data: activeConstructors } = useSuspenseQuery(constructorsQuery);
  const { races } = useLoaderData({
    from: '/_authenticated/_team-required/my-team',
  });

  // requireTeam guarantees a team at runtime; this narrows the nullable queryFn
  // result and falls back to the route's Create-Team notFoundComponent.
  if (!team) throw notFound();

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
  const { data: activeDrivers } = useSuspenseQuery(driversQuery);
  const { data: activeConstructors } = useSuspenseQuery(constructorsQuery);
  const { team, races } = useLoaderData({
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
  const captainMutation = useSetCaptain();
  const captainDriverId = team.drivers.find((d) => d.isCaptain)?.id ?? null;
  const captainError = captainMutation.error
    ? captainMutation.error.message || 'Failed to update captain'
    : null;
  const currentRace = races.find((r) => r.isCurrent) ?? races.at(-1);

  const countdown = useLockCountdown(currentRace?.lockDeadline ?? null);
  const isLocked = countdown.isLocked;

  const handleSetCaptain = (driverId: number | null) => captainMutation.mutate(driverId);

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
        <LockCountdown
          state={countdown}
          variant="compact"
          className="w-full sm:w-auto sm:shrink-0 sm:text-right"
        />
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
