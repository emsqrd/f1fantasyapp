import type { Team } from '@/contracts/Team';
import type { RouterContext } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import { redirect } from '@tanstack/react-router';

/**
 * Route guard for authenticated routes.
 *
 * Assumes auth has finished loading: `InnerApp` only mounts the router once auth
 * is ready, so this guard never runs mid-load.
 */
export async function requireAuth(context: RouterContext): Promise<void> {
  if (context.auth.user) return;

  // context.auth.user is a React-state snapshot; it lags Supabase right after
  // a session is established. Check getSession() before redirecting.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return;

  throw redirect({
    to: '/',
    replace: true,
  });
}

/**
 * Route guard for team-gated routes. Auth is enforced by the enclosing
 * `_authenticated` layout, so this guard does not re-check it.
 */
export function requireTeam(context: RouterContext): { team: Team } {
  // context.team is set fresh by the root beforeLoad on every navigation, so
  // reading it here is as current as a re-fetch.
  if (!context.team) {
    throw redirect({
      to: '/create-team',
      replace: true,
    });
  }

  return { team: context.team };
}

/**
 * Route guard for routes that require the user NOT to have a team (e.g.
 * `/create-team`). Auth is enforced by the enclosing `_authenticated` layout, so
 * this guard does not re-check it.
 */
export function requireNoTeam(context: RouterContext): { team: null } {
  if (context.team) {
    throw redirect({
      to: '/',
      replace: true,
    });
  }

  return { team: null };
}
