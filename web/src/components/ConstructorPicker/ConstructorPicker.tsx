import type { Constructor } from '@/contracts/Role';
import type { TeamConstructor } from '@/contracts/Team';
import { useLineupPicker } from '@/hooks/useLineupPicker';
import { addConstructorToTeam, removeConstructorFromTeam } from '@/services/teamService';
import { useMemo } from 'react';

import { ConstructorCard } from '../ConstructorCard/ConstructorCard';
import { ConstructorListItem } from '../ConstructorListItem/ConstructorListItem';
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

interface ConstructorPickerProps {
  activeConstructors: Constructor[];
  teamConstructors?: TeamConstructor[];
}

const CONSTRUCTOR_SLOTS = 4;

export function ConstructorPicker({
  activeConstructors,
  teamConstructors,
}: ConstructorPickerProps) {
  // build lineup with existing constructors
  const lineup = useMemo(() => {
    const slots: (Constructor | null)[] = Array(CONSTRUCTOR_SLOTS).fill(null);

    teamConstructors?.forEach((constructor) => {
      slots[constructor.slotPosition] = { ...constructor };
    });

    return slots;
  }, [teamConstructors]);

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
    items: activeConstructors,
    lineup,
    lineupSize: CONSTRUCTOR_SLOTS,
    itemType: 'constructor',
    addToTeam: addConstructorToTeam,
    removeFromTeam: removeConstructorFromTeam,
  });

  return (
    <>
      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
        {displayLineup.map((constructor, idx) => (
          <ConstructorCard
            key={idx}
            constructor={constructor}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}

        {isPending && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="border-primary animate-spin-rounded-full h-8 w-8 border-b-2" />
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
            <SheetTitle>Select Constructor</SheetTitle>
            <SheetDescription>
              Choose a constructor from the list below to add to your team.
            </SheetDescription>
            {error && <InlineError message={error} />}
          </SheetHeader>
          <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
            <ul className="space-y-2">
              {pool.map((constructor) => (
                <ConstructorListItem
                  key={constructor.id}
                  constructor={constructor}
                  onSelect={() => {
                    if (selectedPosition !== null) {
                      handleAdd(selectedPosition, constructor);
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
