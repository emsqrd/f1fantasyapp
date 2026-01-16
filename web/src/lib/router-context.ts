import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import type { Team } from '@/contracts/Team';
import type { UserProfile } from '@/contracts/UserProfile';

/**
 * Router context interface that will be available to all routes via TanStack Router.
 * This context is provided at the root level and consumed in route guards and loaders.
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/guide/route-trees#router-context TanStack Router Context Documentation}
 */
export interface RouterContext {
  /** Authentication state and methods from AuthContext */
  auth: AuthContextType;

  /** Team state and methods from TeamContext */
  teamContext: TeamContextType;

  /** Actual team data from route */
  team: Team | null;

  profile: UserProfile | null;
}
