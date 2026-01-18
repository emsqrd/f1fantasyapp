import type { League } from '@/contracts/League';
import { Link, useLoaderData } from '@tanstack/react-router';

import { AppContainer } from '../AppContainer/AppContainer';
import { Card } from '../ui/card';

interface PublicLeaguesLoaderData {
  leagues: League[];
}

export function BrowseLeagues() {
  const { leagues } = useLoaderData({
    from: '/_authenticated/_team-required/browse-leagues',
  }) as PublicLeaguesLoaderData;

  const publicLeaguesExist = leagues.length > 0;

  return (
    <AppContainer maxWidth="md" className="p-8">
      <header className="flex justify-between pb-4">
        <h2 className="mb-2 text-2xl font-semibold">Available Leagues</h2>
      </header>
      {!publicLeaguesExist ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-lg">There are no available leagues to display</p>
        </div>
      ) : (
        <div aria-label="public-leagues">
          {leagues.map((league) => (
            <Card key={league.id} className="mb-4 overflow-hidden p-0">
              <Link
                to="/league/$leagueId"
                params={{ leagueId: String(league.id) }}
                className="hover:bg-accent focus:ring-ring block w-full cursor-pointer p-6 text-left transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                aria-label={`View public league: ${league.name}`}
                preload="intent"
              >
                <h3 className="text-lg font-medium">{league.name}</h3>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppContainer>
  );
}
