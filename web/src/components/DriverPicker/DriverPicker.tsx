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
  readOnly: boolean;
  remainingBudget: number;
  captainDriverId?: number | null;
  onSetCaptain?: (driverId: number | null) => void;
}

const DRIVER_SLOTS = 4;

export function DriverPicker({
  activeDrivers,
  teamDrivers,
  readOnly,
  remainingBudget,
  captainDriverId,
  onSetCaptain,
}: DriverPickerProps) {
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
      {error && (
        <div className="pb-4">
          <InlineError message={error} />
        </div>
      )}
      {onSetCaptain && (
        <div
          aria-hidden={!!captainDriverId}
          className={`grid transition-[grid-template-rows] duration-300 ${captainDriverId ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
        >
          <div className="overflow-hidden">
            <p className="text-muted-foreground pb-3 text-center text-xs">
              Pick a captain — tap <strong className="text-foreground">C</strong> on any driver for
              2× points
            </p>
          </div>
        </div>
      )}
      <div className="relative grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
        {displayLineup.map((driver, idx) => (
          <DriverCard
            key={idx}
            driver={driver}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
            readOnly={readOnly}
            isCaptain={driver !== null && driver.id === captainDriverId}
            onSetCaptain={
              driver && onSetCaptain
                ? () => onSetCaptain(driver.id === captainDriverId ? null : driver.id)
                : undefined
            }
          />
        ))}

        {isPending && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        )}
      </div>

      {!readOnly && (
        <Sheet open={selectedPosition !== null} onOpenChange={(open) => !open && closePicker()}>
          <SheetTrigger asChild>
            <div />
          </SheetTrigger>
          <SheetContent className="bg-card flex h-full flex-col sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Select Driver</SheetTitle>
              <SheetDescription>
                Choose a driver from the list below to add to your team.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
              <ul className="divide-border divide-y">
                {pool.map((driver) => (
                  <DriverListItem
                    key={driver.id}
                    driver={driver}
                    onSelect={() => {
                      if (selectedPosition !== null && !isPending) {
                        handleAdd(selectedPosition, driver);
                      }
                    }}
                    disabled={driver.price > remainingBudget}
                  />
                ))}
              </ul>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
