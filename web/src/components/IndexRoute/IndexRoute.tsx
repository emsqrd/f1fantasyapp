import { useAuth } from '@/hooks/useAuth';
import { profileQuery } from '@/services/userProfileService';
import { useQuery } from '@tanstack/react-query';
import { useLoaderData } from '@tanstack/react-router';

import { Home } from '../Home/Home';
import { LandingPage } from '../LandingPage/LandingPage';

export function IndexRoute() {
  const { user } = useAuth();
  const { home } = useLoaderData({ from: '/' });
  const { data: profile } = useQuery({ ...profileQuery, enabled: !!user });

  if (home === null) {
    return <LandingPage />;
  }

  return (
    <Home
      name={profile?.firstName ?? profile?.displayName ?? ''}
      summary={home.summary}
      races={home.races}
    />
  );
}
