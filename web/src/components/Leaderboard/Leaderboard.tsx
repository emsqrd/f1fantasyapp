import { LeaderboardHeader } from '@/components/LeaderboardHeader/LeaderboardHeader';
import { PositionDelta } from '@/components/PositionDelta/PositionDelta';
import { cn } from '@/lib/utils';
import { Link, getRouteApi, useRouteContext } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const routeApi = getRouteApi('/_authenticated/_team-required/league/$leagueId');

const rowBase =
  'grid w-full items-baseline gap-3 grid-cols-[--spacing(8)_1fr_--spacing(13)] sm:items-center sm:grid-cols-[--spacing(13)_1fr_--spacing(18)_--spacing(24)_--spacing(9)] text-left transition-colors';
const rowChrome =
  'rounded-[0.65rem] border bg-card p-3 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:px-4 sm:py-3';
const rowHover = 'sm:hover:bg-accent';
const rowFocus = 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';
const rowMyTeam =
  'border-[var(--row-highlight-border)] bg-[color-mix(in_oklab,var(--row-highlight)_17%,var(--card))] sm:bg-[color-mix(in_oklab,var(--row-highlight)_17%,transparent)] sm:shadow-[inset_0_0_0_1.5px_var(--row-highlight-border)]';

interface LeaderboardProps {
  actions?: ReactNode;
  inlineAction?: ReactNode;
}

export function Leaderboard({ actions, inlineAction }: LeaderboardProps = {}) {
  const { league, standings } = routeApi.useLoaderData();
  const { profile } = useRouteContext({ from: '/_authenticated' });

  const entries = standings.standings;

  return (
    <>
      <LeaderboardHeader
        league={league}
        standings={standings}
        actions={actions}
        inlineAction={inlineAction}
      />
      {entries.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-lg">No teams in this league yet.</p>
        </div>
      ) : (
        <div className="sm:border-border sm:bg-card sm:overflow-hidden sm:rounded-[0.65rem] sm:border">
          <div
            className="text-muted-foreground grid grid-cols-[--spacing(8)_1fr_--spacing(13)] items-center gap-3 px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase sm:hidden"
            aria-hidden="true"
          >
            <div className="text-center">Pos</div>
            <div>Team</div>
            <div className="text-right">Pts</div>
          </div>
          <div
            className="text-muted-foreground bg-secondary border-border hidden grid-cols-[--spacing(13)_1fr_--spacing(18)_--spacing(24)_--spacing(9)] items-center gap-3 border-b px-4 py-2.5 text-[11px] font-semibold tracking-wider uppercase sm:grid"
            aria-hidden="true"
          >
            <div className="text-center">Pos</div>
            <div>Team</div>
            <div className="text-center">Move</div>
            <div className="text-right">Pts</div>
            <div />
          </div>
          <ul
            role="list"
            aria-label="Leaderboard"
            className="flex flex-col gap-2 sm:gap-0 sm:[&>li:last-child>a]:border-b-0"
          >
            {entries.map((entry) => {
              const isMyRow = entry.ownerId === profile?.id;
              const linkBase = `Open ${entry.teamName}`;
              const ariaLabel = isMyRow
                ? `${linkBase}, your team, position ${entry.position}`
                : `${linkBase}, position ${entry.position}`;

              const linkContent = (
                <>
                  <div className="flex items-center justify-center">
                    <span className="text-foreground font-mono text-[16px] font-semibold tabular-nums">
                      {entry.position}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground truncate font-semibold">
                          {entry.teamName}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                        <span className="truncate">{entry.ownerName}</span>
                        <span aria-hidden="true" className="sm:hidden">
                          ·
                        </span>
                        <PositionDelta
                          value={entry.positionChange}
                          variant="inline"
                          className="sm:hidden"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="hidden justify-center sm:flex">
                    <PositionDelta value={entry.positionChange} />
                  </div>
                  <div className="text-foreground text-right font-mono text-[15px] font-semibold tabular-nums">
                    {entry.totalPoints.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground hidden justify-center sm:flex">
                    <ChevronRightIcon className="size-4" />
                  </div>
                </>
              );

              const className = cn(rowBase, rowChrome, rowHover, rowFocus, isMyRow && rowMyTeam);

              return (
                <li key={entry.teamId}>
                  {isMyRow ? (
                    <Link to="/my-team" className={className} aria-label={ariaLabel}>
                      {linkContent}
                    </Link>
                  ) : (
                    <Link
                      to="/team/$teamId"
                      params={{ teamId: String(entry.teamId) }}
                      className={className}
                      aria-label={ariaLabel}
                    >
                      {linkContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
