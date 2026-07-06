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
  readOnly: boolean;
  remainingBudget: number;
}

const CONSTRUCTOR_SLOTS = 2;

export function ConstructorPicker({
  activeConstructors,
  teamConstructors,
  readOnly,
  remainingBudget,
}: ConstructorPickerProps) {
  // build lineup with existing constructors
  const lineup = useMemo(() => {
    const slots = Array<Constructor | null>(CONSTRUCTOR_SLOTS).fill(null);

    teamConstructors?.forEach((constructor) => {
      slots[constructor.slotPosition] = { ...constructor };
    });

    return slots;
  }, [teamConstructors]);

  const {
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
    itemType: 'constructor',
    addToTeam: addConstructorToTeam,
    removeFromTeam: removeConstructorFromTeam,
  });

  const filledCount = lineup.filter(Boolean).length;

  return (
    <>
      {error && (
        <div className="pb-4">
          <InlineError message={error} />
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Constructors
        </span>
        <span className="text-muted-foreground text-xs">
          {filledCount} / {CONSTRUCTOR_SLOTS}
        </span>
      </div>
      <div className="relative grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
        {lineup.map((constructor, idx) => (
          <ConstructorCard
            key={idx}
            constructor={constructor}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
            readOnly={readOnly}
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
              <SheetTitle>Select Constructor</SheetTitle>
              <SheetDescription>Choose a constructor to add to your team.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
              <ul className="divide-border divide-y">
                {pool.map((constructor) => (
                  <ConstructorListItem
                    key={constructor.id}
                    constructor={constructor}
                    onSelect={() => {
                      if (selectedPosition !== null && !isPending) {
                        handleAdd(selectedPosition, constructor);
                      }
                    }}
                    disabled={constructor.price > remainingBudget}
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
