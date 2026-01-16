import type { League } from '@/contracts/League';
import { Link, useLoaderData, useNavigate } from '@tanstack/react-router';

import { AppContainer } from '../AppContainer/AppContainer';
import { CreateLeague } from '../CreateLeague/CreateLeague';
import { Card } from '../ui/card';

// Type for the route's loader data
interface LeagueListLoaderData {
  leagues: League[];
}

export function LeagueList() {
  // Get leagues data from the route loader
  // Data is already loaded before this component renders (no loading state needed)
  const { leagues } = useLoaderData({
    from: '/_authenticated/_team-required/leagues',
  }) as LeagueListLoaderData;

  const navigate = useNavigate();

  const hasLeagues = leagues.length > 0;

  return (
    <AppContainer maxWidth="md" className="p-8">
      <header className="flex justify-between pb-4">
        <h2 className="mb-2 text-2xl font-semibold">Joined Leagues</h2>
        <CreateLeague
          onLeagueCreated={(league) =>
            navigate({ to: '/league/$leagueId', params: { leagueId: String(league.id) } })
          }
        ></CreateLeague>
      </header>
      {!hasLeagues ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-lg">You haven't joined any leagues yet!</p>
        </div>
      ) : (
        <div aria-label="league-list">
          {leagues.map((league) => (
            <Card key={league.id} className="mb-4 overflow-hidden p-0">
              <Link
                to="/league/$leagueId"
                params={{ leagueId: String(league.id) }}
                className="hover:bg-accent focus:ring-ring block w-full cursor-pointer p-6 text-left transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                aria-label={`View league: ${league.name}`}
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
