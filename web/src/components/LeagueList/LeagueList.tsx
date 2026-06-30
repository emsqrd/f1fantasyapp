import { cn } from '@/lib/utils';
import { leagueQueries } from '@/services/leagueService';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';

import { AppContainer } from '../AppContainer/AppContainer';
import { CreateLeague } from '../CreateLeague/CreateLeague';

const rowBase = 'flex w-full items-center gap-3 transition-colors';
const rowChrome =
  'rounded-[0.65rem] border bg-card p-4 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:px-4 sm:py-3';
const rowHover = 'sm:hover:bg-accent';
const rowFocus = 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

export function LeagueList() {
  const { data: leagues } = useSuspenseQuery(leagueQueries.mine());

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
        <div className="sm:border-border sm:bg-card sm:overflow-hidden sm:rounded-[0.65rem] sm:border">
          <ul
            role="list"
            aria-label="league-list"
            className="flex flex-col gap-2 sm:gap-0 sm:[&>li:not(:last-child)>a]:border-b"
          >
            {leagues.map((league) => (
              <li key={league.id}>
                <Link
                  to="/league/$leagueId"
                  params={{ leagueId: String(league.id) }}
                  className={cn(rowBase, rowChrome, rowHover, rowFocus)}
                  aria-label={`Open ${league.name}`}
                >
                  <h3 className="text-foreground min-w-0 flex-1 truncate text-lg font-medium">
                    {league.name}
                  </h3>
                  <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppContainer>
  );
}
