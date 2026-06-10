import type { Auth } from '@/lib/authStore';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Router context interface that will be available to all routes via TanStack Router.
 * This context is provided at the root level and consumed in route guards and loaders.
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#router-context TanStack Router Context Documentation}
 */
export interface RouterContext {
  /** Authentication state and methods from the auth store */
  auth: Auth;

  queryClient: QueryClient;
}
