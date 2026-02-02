import type { League } from '@/contracts/League';
import { Link, useLoaderData, useNavigate } from '@tanstack/react-router';

import { AppContainer } from '../AppContainer/AppContainer';
import { CreateLeague } from '../CreateLeague/CreateLeague';
import { buttonVariants } from '../ui/button';
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
    <AppContainer maxWidth="md">
      <header className="flex justify-end pb-4">
        <CreateLeague
          onLeagueCreated={(league) =>
            navigate({ to: '/league/$leagueId', params: { leagueId: String(league.id) } })
          }
        />
      </header>
      {!hasLeagues ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-lg">You haven't joined any leagues yet!</p>
        </div>
      ) : (
        <div aria-label="league-list">
          {leagues.map((league) => (
            <Card key={league.id} className="mb-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <h3 className="text-lg font-medium">{league.name}</h3>
                </div>
                <Link
                  to="/league/$leagueId"
                  params={{ leagueId: String(league.id) }}
                  className={buttonVariants({ variant: 'outline' })}
                  aria-label={`View league: ${league.name}`}
                >
                  View
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppContainer>
  );
}
