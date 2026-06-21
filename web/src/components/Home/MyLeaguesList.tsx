import { InlineError } from '@/components/InlineError/InlineError';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { standingsQueries } from '@/services/standingsService';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { JoinLeaguesPrompt } from './JoinLeaguesPrompt';

const EM_DASH = '—';

const rowBase = 'grid w-full items-center gap-3 grid-cols-[1fr_auto] text-left transition-colors';
const rowChrome =
  'rounded-[0.65rem] border bg-card px-4 py-3 md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:px-6 md:py-3';
const rowHover = 'md:hover:bg-accent';
const rowFocus = 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

export function MyLeaguesList() {
  const { data, isPending, isError, refetch } = useQuery(standingsQueries.mine());

  if (isPending) {
    return null;
  }

  if (isError) {
    return (
      <section className="flex flex-col gap-3">
        <InlineError message="We couldn't load your leagues." />
        <Button variant="outline" size="sm" className="self-start" onClick={() => refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  if (data.length === 0) {
    return <JoinLeaguesPrompt />;
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-foreground text-base font-bold tracking-tight md:text-lg">
          My Leagues
        </h3>
        <Link to="/leagues" className="text-primary text-xs font-medium hover:underline md:text-sm">
          View all <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="md:border-border md:bg-card md:overflow-hidden md:rounded-[0.65rem] md:border">
        <div
          className="text-muted-foreground grid grid-cols-[1fr_auto] items-center gap-3 px-4 pb-2 text-[11px] font-semibold tracking-wider uppercase md:hidden"
          aria-hidden="true"
        >
          <div>League</div>
          <div className="text-right">Pos</div>
        </div>
        <div
          className="text-muted-foreground bg-secondary border-border hidden grid-cols-[1fr_auto] items-center gap-3 border-b px-6 py-2.5 text-[11px] font-semibold tracking-wider uppercase md:grid"
          aria-hidden="true"
        >
          <div>League</div>
          <div className="text-right">Pos</div>
        </div>
        <ul
          role="list"
          aria-label="My Leagues"
          className="flex flex-col gap-2 md:gap-0 md:[&>li:last-child>a]:border-b-0"
        >
          {data.map((entry) => (
            <li key={entry.leagueId}>
              <Link
                to="/league/$leagueId"
                params={{ leagueId: String(entry.leagueId) }}
                className={cn(rowBase, rowChrome, rowHover, rowFocus)}
                aria-label={`Open ${entry.leagueName}`}
              >
                <div className="text-foreground min-w-0 truncate text-sm font-semibold">
                  {entry.leagueName}
                </div>
                <span className="text-foreground text-right font-mono text-sm font-semibold tabular-nums md:text-base">
                  {entry.position ?? EM_DASH}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
