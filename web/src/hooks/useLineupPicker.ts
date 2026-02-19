import * as Sentry from '@sentry/react';
import { useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

interface UseLineupPickerOptions<T extends { id: number }> {
  items: T[];
  lineup: (T | null)[];
  lineupSize: number;
  itemType: string;
  addToTeam: (itemId: number, position: number) => Promise<void>;
  removeFromTeam: (position: number) => Promise<void>;
  maxDuplicates?: number;
}

/**
 * Manages lineup selection state and operations for picker components.
 * Handles item pool filtering, picker state, and add/remove operations with error handling.
 */
export function useLineupPicker<T extends { id: number }>({
  items,
  lineup,
  lineupSize,
  itemType,
  addToTeam,
  removeFromTeam,
  maxDuplicates = 1,
}: UseLineupPickerOptions<T>) {
  const router = useRouter();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pad lineup with nulls to match lineupSize for empty slots
   */
  const displayLineup = useMemo(() => {
    const currentLineup = lineup ?? [];

    return currentLineup.length === lineupSize
      ? currentLineup
      : [...currentLineup, ...Array(lineupSize - currentLineup.length).fill(null)];
  }, [lineup, lineupSize]);

  /**
   * Filter out items that have reached their maximum allowed duplicates from the available pool
   */
  const pool = useMemo(() => {
    const counts = new Map<number, number>();
    displayLineup
      .filter((item): item is T => item !== null)
      .forEach((item) => {
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
      });
    return items.filter((item) => (counts.get(item.id) ?? 0) < maxDuplicates);
  }, [items, displayLineup, maxDuplicates]);

  /**
   * Adds an item to the lineup at the specified position.
   * Closes the picker on both success and error.
   */
  const handleAdd = async (position: number, item: T) => {
    setIsPending(true);
    setError(null);

    try {
      await addToTeam(item.id, position);
      await router.invalidate();
    } catch (err) {
      Sentry.logger.error(`Failed to add ${itemType} to lineup`, {
        itemType,
        position,
        itemId: item.id,
        error: err,
      });

      setError(`Failed to add ${itemType}. Please try again.`);
    } finally {
      setIsPending(false);
      setSelectedPosition(null);
    }
  };

  /**
   * Removes an item from the lineup at the specified position.
   */
  const handleRemove = async (position: number) => {
    setIsPending(true);
    setError(null);

    try {
      await removeFromTeam(position);
      await router.invalidate();
    } catch (err) {
      Sentry.logger.error(`Failed to remove ${itemType} from lineup`, {
        itemType,
        position,
        error: err,
      });

      setError(`Failed to remove ${itemType}. Please try again.`);
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Opens the picker overlay for the specified position.
   * Clears any previous errors and prevents opening during pending operations.
   */
  const openPicker = (position: number) => {
    if (!isPending) {
      setError(null);
      setSelectedPosition(position);
    }
  };

  return {
    displayLineup,
    pool,
    selectedPosition,
    isPending,
    error,
    openPicker,
    closePicker: () => setSelectedPosition(null),
    handleAdd,
    handleRemove,
  };
}
