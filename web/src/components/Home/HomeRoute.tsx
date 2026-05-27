import { useLoaderData, useRouteContext } from '@tanstack/react-router';

import { LandingPage } from '../LandingPage/LandingPage';
import { Home } from './Home';

export function HomeRoute() {
  const { home } = useLoaderData({ from: '/' });
  const { profile, team } = useRouteContext({ from: '__root__' });

  if (home === null || profile === null) {
    return <LandingPage />;
  }

  return (
    <Home
      name={profile.firstName ?? profile.displayName}
      team={team}
      summary={home.summary}
      standings={home.standings}
      races={home.races}
    />
  );
}
