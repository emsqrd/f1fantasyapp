import { useCallback, useMemo, useState } from 'react';

export function useLineup<T extends { id: number }>(
  initialPool: T[],
  initialLineup: (T | null)[] | null | undefined,
  lineupSize = 4,
) {
  // Ensure initialLineup is always an array for null safety
  const safeInitialLineup = initialLineup ?? [];

  const [lineup, setLineup] = useState<(T | null)[]>(() => {
    // Lazy initialization to avoid recalculation on every render
    return safeInitialLineup.length === lineupSize
      ? safeInitialLineup
      : [...safeInitialLineup, ...Array(lineupSize - safeInitialLineup.length).fill(null)];
  });

  // Derive pool from lineup - no separate state needed
  // This automatically stays in sync and avoids nested setState
  const pool = useMemo(() => {
    const selectedIds = lineup.filter((item): item is T => item !== null).map((item) => item.id);
    return initialPool.filter((item) => !selectedIds.includes(item.id));
  }, [lineup, initialPool]);

  const add = useCallback((idx: number, item: T) => {
    setLineup((prev) => {
      const updated = [...prev];
      updated[idx] = item;
      return updated;
    });
  }, []);

  const remove = useCallback((idx: number) => {
    setLineup((prev) => {
      const updated = [...prev];
      updated[idx] = null;
      return updated;
    });
  }, []);

  return { lineup, pool, add, remove };
}
