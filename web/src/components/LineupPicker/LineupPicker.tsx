import type { BaseRole } from '@/contracts/Role';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

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
 * T represents the item type (Driver, Constructor, etc.)
 */
export interface LineupCardProps<T extends BaseRole> {
  /** The item to display, or null for empty positions */
  item: T | null;
  /** Callback when the card is clicked */
  onClick: () => void;
  /** Callback to remove the item from this position */
  onRemove: () => void;
}

/**
 * Props for list item components displayed in the selection sheet.
 * T represents the item type (Driver, Constructor, etc.)
 */
export interface LineupListItemProps<T extends BaseRole> {
  /** The item to display in the list */
  item: T;
  /** Callback when the item is selected */
  onSelect: () => void;
}

/**
 * Props for the internal LineupPickerContent component.
 * This component handles the core picker logic with lineup management and selection.
 */
interface LineupPickerContentProps<T extends BaseRole> {
  /** Pool of available items to choose from */
  itemPool: T[];
  /** Number of positions in the lineup */
  lineupSize: number;
  /** Currently selected items from route loader */
  lineup?: (T | null)[];
  /** Component to render each card in the grid */
  CardComponent: React.ComponentType<LineupCardProps<T>>;
  /** Component to render each item in the selection list */
  ListItemComponent: React.ComponentType<LineupListItemProps<T>>;
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
 * Derives lineup from route data (server state as source of truth).
 * Mutations wait for server response before UI updates.
 */
function LineupPickerContent<T extends BaseRole>({
  itemPool,
  lineupSize,
  lineup: initialItems = [],
  CardComponent,
  ListItemComponent,
  addToTeam,
  removeFromTeam,
  sheetTitle,
  sheetDescription,
  gridClassName = 'grid grid-cols-1 gap-4 sm:grid-cols-2',
}: LineupPickerContentProps<T>) {
  const router = useRouter();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Derive lineup from route data
  const displayLineup = useMemo(() => {
    const safe = initialItems ?? [];
    return safe.length === lineupSize
      ? safe
      : [...safe, ...Array(lineupSize - safe.length).fill(null)];
  }, [initialItems, lineupSize]);

  // Derive pool from current lineup
  const pool = useMemo(() => {
    const selectedIds = new Set(
      displayLineup.filter((item): item is T => item !== null).map((item) => item.id),
    );
    return itemPool.filter((item) => !selectedIds.has(item.id));
  }, [itemPool, displayLineup]);

  const handleAdd = async (position: number, item: T) => {
    setIsPending(true);
    try {
      await addToTeam(item.id, position);
      await router.invalidate();
      setSelectedPosition(null);
    } catch (error) {
      console.error('Failed to add item:', error);
    } finally {
      setIsPending(false);
    }
  };

  const handleRemove = async (position: number) => {
    setIsPending(true);
    try {
      await removeFromTeam(position);
      await router.invalidate();
    } catch (error) {
      console.error('Failed to remove item:', error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      {/* Grid of cards representing lineup positions */}
      <div className={`${gridClassName} relative`}>
        {displayLineup.map((item, idx) => (
          <CardComponent
            key={idx}
            item={item}
            onClick={() => !isPending && setSelectedPosition(idx)}
            onRemove={() => !isPending && handleRemove(idx)}
          />
        ))}

        {/* Loading overlay during mutations */}
        {isPending && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        )}
      </div>

      {/* Selection sheet */}
      <Sheet
        open={selectedPosition !== null && !isPending}
        onOpenChange={(o) => !o && setSelectedPosition(null)}
      >
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
                  onSelect={() => {
                    if (selectedPosition !== null) {
                      handleAdd(selectedPosition, item);
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
 * Props for the main LineupPicker component.
 * This defines the external API for using the generic picker.
 */
export interface LineupPickerProps<T extends BaseRole> {
  /** Number of positions in the lineup (e.g., 5 for drivers, 2 for constructors) */
  lineupSize?: number;
  /** Initially selected items */
  lineup?: (T | null)[];
  /** Component to render each card in the grid */
  CardComponent: React.ComponentType<LineupCardProps<T>>;
  /** Component to render each item in the selection list */
  ListItemComponent: React.ComponentType<LineupListItemProps<T>>;
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
 * Generic LineupPicker component for selecting items (drivers, constructors, etc.) for a team.
 *
 * This component handles:
 * - Data fetching of available items pool with loading and error states
 * - Current lineup derived from route loader data (server state)
 * - Add/remove operations with React 19's useOptimistic for instant UI feedback
 * - Automatic revert on mutation errors
 * - Generic rendering via component props
 */
export function LineupPicker<T extends BaseRole>({
  lineupSize = 5,
  lineup: initialItems,
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
}: LineupPickerProps<T>) {
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
    <LineupPickerContent
      itemPool={itemPool}
      lineupSize={lineupSize}
      lineup={initialItems}
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
