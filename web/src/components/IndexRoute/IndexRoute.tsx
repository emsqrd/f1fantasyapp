import { useLoaderData, useRouteContext } from '@tanstack/react-router';

import { Home } from '../Home/Home';
import { LandingPage } from '../LandingPage/LandingPage';

export function IndexRoute() {
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
