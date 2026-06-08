import type { AuthContextType } from '@/contexts/AuthContext';
import type { Team } from '@/contracts/Team';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Router context interface that will be available to all routes via TanStack Router.
 * This context is provided at the root level and consumed in route guards and loaders.
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#router-context TanStack Router Context Documentation}
 */
export interface RouterContext {
  /** Authentication state and methods from AuthContext */
  auth: AuthContextType;

  queryClient: QueryClient;

  /** Actual team data from route */
  team: Team | null;
}
