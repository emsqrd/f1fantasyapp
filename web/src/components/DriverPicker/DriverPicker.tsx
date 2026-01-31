import type { Driver } from '@/contracts/Role';
import type { TeamDriver } from '@/contracts/Team';
import { useLineupPicker } from '@/hooks/useLineupPicker';
import { addDriverToTeam, removeDriverFromTeam } from '@/services/teamService';
import { useMemo } from 'react';

import { DriverCard } from '../DriverCard/DriverCard';
import { DriverListItem } from '../DriverListItem/DriverListItem';
import { InlineError } from '../InlineError/InlineError';
import { ScrollArea } from '../ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

interface DriverPickerProps {
  activeDrivers: Driver[];
  teamDrivers?: TeamDriver[];
}

const DRIVER_SLOTS = 4;

export function DriverPicker({ activeDrivers, teamDrivers }: DriverPickerProps) {
  // build lineup with existing drivers
  const lineup = useMemo(() => {
    const slots: (Driver | null)[] = Array(DRIVER_SLOTS).fill(null);

    teamDrivers?.forEach((driver) => {
      slots[driver.slotPosition] = { ...driver };
    });

    return slots;
  }, [teamDrivers]);

  const {
    displayLineup,
    pool,
    selectedPosition,
    isPending,
    error,
    openPicker,
    closePicker,
    handleAdd,
    handleRemove,
  } = useLineupPicker({
    items: activeDrivers,
    lineup,
    lineupSize: DRIVER_SLOTS,
    itemType: 'driver',
    addToTeam: addDriverToTeam,
    removeFromTeam: removeDriverFromTeam,
  });

  return (
    <>
      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
        {displayLineup.map((driver, idx) => (
          <DriverCard
            key={idx}
            driver={driver}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}

        {isPending && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        )}
      </div>

      <Sheet
        open={selectedPosition !== null && !isPending}
        onOpenChange={(open) => !open && closePicker()}
      >
        <SheetTrigger asChild>
          <div />
        </SheetTrigger>
        <SheetContent className="flex h-full w-80 flex-col">
          <SheetHeader>
            <SheetTitle>Select Driver</SheetTitle>
            <SheetDescription>
              Choose a driver from the list below to add to your team.
            </SheetDescription>
            {error && <InlineError message={error} />}
          </SheetHeader>
          <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
            <ul className="space-y-2">
              {pool.map((driver) => (
                <DriverListItem
                  key={driver.id}
                  driver={driver}
                  onSelect={() => {
                    if (selectedPosition !== null) {
                      handleAdd(selectedPosition, driver);
                    }
                  }}
                />
              ))}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
