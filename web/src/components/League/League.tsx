import type { League as LeagueType } from '@/contracts/League';
import { Link, useLoaderData } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

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

  return (
    <AppContainer maxWidth="md">
      <header className="m-4">
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/leagues"
            className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors"
            preload="intent"
          >
            <ChevronLeft />
            Back to Leagues
          </Link>
        </nav>
      </header>

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
