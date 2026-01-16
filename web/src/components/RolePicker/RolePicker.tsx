import type { BaseRole } from '@/contracts/Role';
import { useLineup } from '@/hooks/useLineup';
import { useEffect, useState } from 'react';

import { ScrollArea } from '../ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

/**
 * Props for card components displayed in the picker grid.
 * T represents the role type (Driver, Constructor, etc.)
 */
export interface RoleCardProps<T extends BaseRole> {
  /** The item to display, or null for empty positions */
  item: T | null;
  /** Callback when the card is clicked */
  onClick: () => void;
  /** Callback to remove the item from this position */
  onRemove: () => void;
}

/**
 * Props for list item components displayed in the selection sheet.
 * T represents the role type (Driver, Constructor, etc.)
 */
export interface RoleListItemProps<T extends BaseRole> {
  /** The item to display in the list */
  item: T;
  /** Callback when the item is selected */
  onSelect: () => void;
}

/**
 * Props for the internal RolePickerContent component.
 * This component handles the core picker logic with lineup management and selection.
 */
interface RolePickerContentProps<T extends BaseRole> {
  /** Pool of available items to choose from */
  itemPool: T[];
  /** Number of positions in the lineup */
  lineupSize: number;
  /** Initially selected items */
  initialItems?: (T | null)[];
  /** Component to render each card in the grid */
  CardComponent: React.ComponentType<RoleCardProps<T>>;
  /** Component to render each item in the selection list */
  ListItemComponent: React.ComponentType<RoleListItemProps<T>>;
  /** Async function to add an item to the team */
  addToTeam: (itemId: number, position: number) => Promise<void>;
  /** Async function to remove an item from the team */
  removeFromTeam: (position: number) => Promise<void>;
  /** Title for the selection sheet */
  sheetTitle: string;
  /** Description for the selection sheet */
  sheetDescription: string;
  /** CSS classes for the grid layout */
  gridClassName?: string;
}

/**
 * Internal component that handles the picker UI and lineup management logic.
 * This is where the generic business logic lives - managing the lineup, handling
 * add/remove operations with rollback, and coordinating the sheet UI.
 */
function RolePickerContent<T extends BaseRole>({
  itemPool,
  lineupSize,
  initialItems = [],
  CardComponent,
  ListItemComponent,
  addToTeam,
  removeFromTeam,
  sheetTitle,
  sheetDescription,
  gridClassName = 'grid grid-cols-1 gap-4 sm:grid-cols-2',
}: RolePickerContentProps<T>) {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const { lineup, pool, add, remove } = useLineup<T>(itemPool, initialItems, lineupSize);

  const handleAdd = async (position: number, item: T) => {
    // Optimistically update state immediately
    add(position, item);
    try {
      // Persist to backend
      await addToTeam(item.id, position);
    } catch (error) {
      // Rollback on error
      remove(position);
      console.error('Failed to add item:', error);
    }
  };

  const handleRemove = async (position: number) => {
    const item = lineup[position];
    // Optimistically update state immediately
    remove(position);
    try {
      // Persist to backend
      await removeFromTeam(position);
    } catch (error) {
      // Rollback on error
      if (item) {
        add(position, item);
      }
      console.error('Failed to remove item:', error);
    }
  };

  return (
    <>
      {/* Grid of cards representing lineup positions */}
      <div className={gridClassName}>
        {lineup.map((item, idx) => (
          <CardComponent
            key={idx}
            item={item}
            onClick={() => setSelectedPosition(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}
      </div>

      {/* Selection sheet */}
      <Sheet open={selectedPosition !== null} onOpenChange={(o) => !o && setSelectedPosition(null)}>
        <SheetTrigger asChild>
          {/* Invisible trigger - we open imperatively via setSelectedPosition */}
          <div />
        </SheetTrigger>
        <SheetContent className="flex h-full w-80 flex-col">
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
            <ul className="space-y-2">
              {pool.map((item) => (
                <ListItemComponent
                  key={item.id}
                  item={item}
                  onSelect={async () => {
                    if (selectedPosition !== null) {
                      await handleAdd(selectedPosition, item);
                      // Always close sheet after add attempt (whether success or rolled back)
                      setSelectedPosition(null);
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

/**
 * Props for the main RolePicker component.
 * This defines the external API for using the generic picker.
 */
export interface RolePickerProps<T extends BaseRole> {
  /** Number of positions in the lineup (e.g., 5 for drivers, 2 for constructors) */
  lineupSize?: number;
  /** Initially selected items */
  initialItems?: (T | null)[];
  /** Component to render each card in the grid */
  CardComponent: React.ComponentType<RoleCardProps<T>>;
  /** Component to render each item in the selection list */
  ListItemComponent: React.ComponentType<RoleListItemProps<T>>;
  /** Async function to fetch available items */
  fetchItems: () => Promise<T[]>;
  /** Async function to add an item to the team */
  addToTeam: (itemId: number, position: number) => Promise<void>;
  /** Async function to remove an item from the team */
  removeFromTeam: (position: number) => Promise<void>;
  /** Title for the selection sheet */
  sheetTitle: string;
  /** Description for the selection sheet */
  sheetDescription: string;
  /** Message to display while loading */
  loadingMessage: string;
  /** Prefix for error messages (e.g., "Failed to load active") */
  errorPrefix: string;
  /** CSS classes for the grid layout */
  gridClassName?: string;
}

/**
 * Generic RolePicker component for selecting items (drivers, constructors, etc.) for a team.
 *
 * This component handles:
 * - Data fetching with loading and error states
 * - Lineup management with add/remove operations
 * - Optimistic updates with automatic rollback on error
 * - Generic rendering via component props
 */
export function RolePicker<T extends BaseRole>({
  lineupSize = 5,
  initialItems,
  CardComponent,
  ListItemComponent,
  fetchItems,
  addToTeam,
  removeFromTeam,
  sheetTitle,
  sheetDescription,
  loadingMessage,
  errorPrefix,
  gridClassName,
}: RolePickerProps<T>) {
  const [itemPool, setItemPool] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await fetchItems();
        setItemPool(data);
      } catch {
        setError(errorPrefix);
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [fetchItems, errorPrefix]);

  if (error) {
    return <div role="alert">{error}</div>;
  }

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <div className="text-center">
          <div
            role="status"
            className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"
          ></div>
          <p className="text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <RolePickerContent
      itemPool={itemPool}
      lineupSize={lineupSize}
      initialItems={initialItems}
      CardComponent={CardComponent}
      ListItemComponent={ListItemComponent}
      addToTeam={addToTeam}
      removeFromTeam={removeFromTeam}
      sheetTitle={sheetTitle}
      sheetDescription={sheetDescription}
      gridClassName={gridClassName}
    />
  );
}
