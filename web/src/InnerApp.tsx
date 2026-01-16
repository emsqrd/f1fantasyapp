import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { useAuth } from './hooks/useAuth';
import { useTeam } from './hooks/useTeam';
import { router } from './router';

/**
 * Invalidate router cache when user identity changes.
 *
 * TanStack Router caches loader data. When auth state changes (sign in, sign out,
 * or switching users), we must invalidate the cache to ensure route loaders
 * refetch user-specific data. Without this, stale data from a previous user
 * could be displayed.
 *
 * This follows TanStack Router's recommended pattern for auth state changes.
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/router-context#invalidating-the-router-context
 */
function useInvalidateOnUserChange(userId: string | undefined, loading: boolean) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip during initial auth loading
    if (loading) return;

    // Skip on first render (initial auth check)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // userId changed after initial load - invalidate cache
    router.invalidate();
  }, [userId, loading]);
}

/**
 * InnerApp component provides router context after auth and team are initialized.
 * This component is separated to satisfy fast refresh requirements.
 */
export function InnerApp() {
  const auth = useAuth();
  const teamContext = useTeam();

  useInvalidateOnUserChange(auth.user?.id, auth.loading);

  // Wait for auth to finish loading before rendering the router
  // This ensures beforeLoad guards receive accurate auth state
  if (auth.loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth, teamContext, team: null }} />;
}
