import type { QueryClient } from '@tanstack/react-query';

interface RouterCache {
  clearCache: () => void;
  invalidate: () => Promise<void>;
}

/**
 * Runs when the signed-in user's identity changes: nothing cached for one
 * identity may be served to another, so both caches are wiped and the
 * matched routes re-run. Eviction must come first — the re-run loaders must
 * not read the previous identity's entries.
 */
export function resetCaches(queryClient: QueryClient, router: RouterCache): void {
  queryClient.clear();
  router.clearCache();
  void router.invalidate();
}
