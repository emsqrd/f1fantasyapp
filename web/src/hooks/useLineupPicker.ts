import { myTeamQuery } from '@/services/teamService';
import * as Sentry from '@sentry/react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

interface UseLineupPickerOptions<T extends { id: number }> {
  items: T[];
  lineup: (T | null)[];
  itemType: 'driver' | 'constructor';
  addToTeam: (itemId: number, position: number) => Promise<void>;
  removeFromTeam: (position: number) => Promise<void>;
}

/**
 * Manages lineup selection state and operations for picker components.
 * Handles item pool filtering, picker state, and add/remove operations with error handling.
 */
export function useLineupPicker<T extends { id: number }>({
  items,
  lineup,
  itemType,
  addToTeam,
  removeFromTeam,
}: UseLineupPickerOptions<T>) {
  const queryClient = useQueryClient();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = useMemo(() => {
    const usedIds = new Set(
      lineup.filter((item): item is T => item !== null).map((item) => item.id),
    );
    return items.filter((item) => !usedIds.has(item.id));
  }, [items, lineup]);

  /**
   * Adds an item to the lineup at the specified position.
   * Closes the picker on both success and error.
   */
  const handleAdd = async (position: number, item: T) => {
    setIsPending(true);
    setError(null);

    try {
      await addToTeam(item.id, position);
      await queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey });
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
      await queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey });
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
