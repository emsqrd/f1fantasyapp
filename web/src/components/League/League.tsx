import type { League as LeagueType } from '@/contracts/League';
import { useLoaderData } from '@tanstack/react-router';

import { AppContainer } from '../AppContainer/AppContainer';
import { Leaderboard } from '../Leaderboard/Leaderboard';

// Type for the route's loader data
interface LeagueLoaderData {
  league: LeagueType;
}

export function League() {
  // Get league data from the route loader
  // Data is already loaded before this component renders (no loading state needed)
  const { league } = useLoaderData({
    from: '/_authenticated/_team-required/league/$leagueId',
  }) as LeagueLoaderData;

  //TODO: How do I send them back to browse leagues from here?
  return (
    <AppContainer maxWidth="md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-4">
          <header className="flex justify-between">
            <div className="flex flex-col items-start pb-1">
              <h2 className="text-3xl font-bold">{league.name}</h2>
            </div>
          </header>
        </div>
        <Leaderboard />
      </div>
    </AppContainer>
  );
}
