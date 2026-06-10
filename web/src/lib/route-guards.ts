import type { RouterContext } from '@/lib/router-context';
import { myTeamQuery } from '@/services/teamService';
import { redirect } from '@tanstack/react-router';

/**
 * Route guard for authenticated routes.
 *
 * Assumes auth has finished loading: `InnerApp` only mounts the router once auth
 * is ready, so this guard never runs mid-load.
 */
export function requireAuth(context: RouterContext): void {
  if (context.auth.user) return;

  throw redirect({
    to: '/',
    replace: true,
  });
}

/**
 * Route guard for team-gated routes. Auth is enforced by the enclosing
 * `_authenticated` layout, so this guard does not re-check it.
 *
 * A `null` team is a genuine no-team user → redirect to create. A fetch failure
 * is left to throw rather than be caught back to `null`, which would misroute a
 * real owner to /create-team on a transient blip.
 */
export async function requireTeam(context: RouterContext): Promise<void> {
  const team = await context.queryClient.ensureQueryData(myTeamQuery);
  if (!team) {
    throw redirect({
      to: '/create-team',
      replace: true,
    });
  }
}
