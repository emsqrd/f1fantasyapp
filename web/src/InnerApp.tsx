import { RouterProvider } from '@tanstack/react-router';

import { useAuth } from './hooks/useAuth';
import { router } from './router';

/**
 * Separated into its own component to satisfy React Fast Refresh requirements.
 */
export function InnerApp() {
  const auth = useAuth();

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

  return (
    <>
      <RouterProvider router={router} />
      {auth.isAuthTransitioning && (
        <div
          role="status"
          className="bg-background fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
    </>
  );
}
