import { useRouteContext } from '@tanstack/react-router';

export function useTeam() {
  const { team } = useRouteContext({ from: '__root__' });
  return { team, hasTeam: team !== null };
}
