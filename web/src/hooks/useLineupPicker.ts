import { myTeamQuery } from '@/services/teamService';
import * as Sentry from '@sentry/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

interface UseLineupPickerOptions<T extends { id: number }> {
  items: T[];
  lineup: (T | null)[];
  itemType: 'driver' | 'constructor';
  addToTeam: (itemId: number, position: number) => Promise<void>;
  removeFromTeam: (position: number) => Promise<void>;
}

/**
 * Manages lineup selection state and add/remove operations for picker components.
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
  const [error, setError] = useState<string | null>(null);

  const pool = useMemo(() => {
    const usedIds = new Set(
      lineup.filter((item): item is T => item !== null).map((item) => item.id),
    );
    return items.filter((item) => !usedIds.has(item.id));
  }, [items, lineup]);

  const addToLineupMutation = useMutation({
    mutationFn: ({ position, item }: { position: number; item: T }) => addToTeam(item.id, position),
    onMutate: () => setError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey }),
    onError: (err, { position, item }) => {
      Sentry.logger.error(`Failed to add ${itemType} to lineup`, {
        itemType,
        position,
        itemId: item.id,
        error: err,
      });

      setError(`Failed to add ${itemType}. Please try again.`);
    },
    // Add closes the picker on both success and error; remove leaves it as-is.
    onSettled: () => setSelectedPosition(null),
  });

  const removeFromLineupMutation = useMutation({
    mutationFn: (position: number) => removeFromTeam(position),
    onMutate: () => setError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey }),
    onError: (err, position) => {
      Sentry.logger.error(`Failed to remove ${itemType} from lineup`, {
        itemType,
        position,
        error: err,
      });

      setError(`Failed to remove ${itemType}. Please try again.`);
    },
  });

  const isPending = addToLineupMutation.isPending || removeFromLineupMutation.isPending;

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
    handleAdd: (position: number, item: T) => addToLineupMutation.mutate({ position, item }),
    handleRemove: (position: number) => removeFromLineupMutation.mutate(position),
  };
}
