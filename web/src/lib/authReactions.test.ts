import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { resetCaches } from './authReactions';

describe('resetCaches', () => {
  it('wipes the query cache and router cache before invalidating', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['me', 'profile'], { id: 1 });
    queryClient.setQueryData(['season', 'current'], { id: 2 });

    let queryEntriesAtInvalidate = -1;
    let routeCacheClearedAtInvalidate = false;
    const router = {
      clearCache: vi.fn(),
      invalidate: vi.fn(() => {
        queryEntriesAtInvalidate = queryClient.getQueryCache().getAll().length;
        routeCacheClearedAtInvalidate = router.clearCache.mock.calls.length > 0;
        return Promise.resolve();
      }),
    };

    resetCaches(queryClient, router);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(router.clearCache).toHaveBeenCalledOnce();
    expect(router.invalidate).toHaveBeenCalledOnce();
    // The re-run loaders must not see the previous identity's entries.
    expect(queryEntriesAtInvalidate).toBe(0);
    expect(routeCacheClearedAtInvalidate).toBe(true);
  });
});
