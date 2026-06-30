import { useAuth } from '@/hooks/useAuth';
import { raceWeekendQueries } from '@/services/raceWeekendService';
import { seasonQueries } from '@/services/seasonService';
import { teamQueries } from '@/services/teamService';
import { profileQueries } from '@/services/userProfileService';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';

import { Home } from '../Home/Home';
import { LandingPage } from '../LandingPage/LandingPage';

export function IndexRoute() {
  const { user } = useAuth();

  if (!user) {
    return <LandingPage />;
  }

  return <AuthedHome />;
}

function AuthedHome() {
  const { data: profile } = useQuery(profileQueries.current());
  const { data: summary } = useSuspenseQuery(teamQueries.summary());
  const { data: season } = useSuspenseQuery(seasonQueries.current());
  const { data: races } = useSuspenseQuery(raceWeekendQueries.list(season?.id ?? null));

  return (
    <Home name={profile?.firstName ?? profile?.displayName ?? ''} summary={summary} races={races} />
  );
}
