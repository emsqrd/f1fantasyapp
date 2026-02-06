import type { Race } from '@/contracts/Race';
import type { Constructor, Driver } from '@/contracts/Role';
import type { Team } from '@/contracts/Team';
import { useLoaderData } from '@tanstack/react-router';
import { useState } from 'react';

import { AppContainer } from '../AppContainer/AppContainer';
import { ConstructorPicker } from '../ConstructorPicker/ConstructorPicker';
import { DriverPicker } from '../DriverPicker/DriverPicker';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface TeamProps {
  team: Team;
  activeDrivers: Driver[];
  activeConstructors: Constructor[];
  races: Race[];
  readOnly: boolean;
}

export function MyTeamRoute() {
  const { team, activeDrivers, activeConstructors, races } = useLoaderData({
    from: '/_authenticated/_team-required/my-team',
  });

  return (
    <Team
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
    <Team
      team={team}
      activeDrivers={activeDrivers}
      activeConstructors={activeConstructors}
      races={races}
      readOnly={true}
    />
  );
}

/**
 * Team component - displays team details with driver and constructor selection.
 *
 * @returns The team details page with driver/constructor pickers
 */
export function Team({ team, activeDrivers, activeConstructors, races, readOnly }: TeamProps) {
  // Track active tab to control visibility while keeping both tabs mounted
  const [activeTab, setActiveTab] = useState('drivers');
  const currentRace = races.find((r) => r.isCurrent) ?? races.at(-1);
  const [selectedRaceId, setSelectedRaceId] = useState<number | undefined>(currentRace?.id);

  return (
    <AppContainer maxWidth="md">
      <div className="mb-4 gap-4 sm:grid sm:grid-cols-2">
        <Card className="mb-6 flex justify-center sm:mb-0">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold">{team.name}</CardTitle>
            {readOnly && (
              <p className="text-muted-foreground text-center text-sm">Owner: {team.ownerName}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-row sm:justify-center">
              <div className="flex flex-col items-center">
                <p className="text-muted-foreground font-medium">Budget</p>
                <h1 className="text-lg font-bold">$200k</h1>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-muted-foreground font-medium">Trades</p>
                <h1 className="text-lg font-bold">3/3</h1>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4 flex flex-col space-y-4 sm:mb-0">
          <Select
            value={selectedRaceId?.toString()}
            onValueChange={(value) => setSelectedRaceId(Number(value))}
          >
            <SelectTrigger className="h-auto min-h-[60px] w-full py-8 [&>span]:block [&>span]:w-full [&>span]:text-left">
              <SelectValue placeholder="Pick a race" />
            </SelectTrigger>
            <SelectContent>
              {races.map((race) => (
                <SelectItem key={race.id} value={race.id.toString()}>
                  <div>
                    <p className="text-muted-foreground font-medium">Round {race.round}</p>
                    <h1 className="text-2xl font-bold">{race.location}</h1>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Card className="gap-2 py-2">
            <CardHeader>
              <CardTitle className="pb-2 text-center text-2xl font-bold">Round Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:flex sm:justify-center sm:gap-8 lg:gap-12">
                <div className="text-center">
                  <p className="text-muted-foreground font-medium">Finished</p>
                  <h1 className="text-lg font-bold">1st</h1>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground font-medium">Points</p>
                  <h1 className="text-lg font-bold">679</h1>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="constructors">Constructors</TabsTrigger>
        </TabsList>
        <TabsContent
          value="drivers"
          forceMount
          style={{ display: activeTab !== 'drivers' ? 'none' : undefined }}
        >
          <Card className="py-4">
            <CardContent className="px-4">
              <DriverPicker
                activeDrivers={activeDrivers}
                teamDrivers={team.drivers}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent
          value="constructors"
          forceMount
          style={{ display: activeTab !== 'constructors' ? 'none' : undefined }}
        >
          <Card className="py-4">
            <CardContent className="px-4">
              <ConstructorPicker
                activeConstructors={activeConstructors}
                teamConstructors={team.constructors}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppContainer>
  );
}
