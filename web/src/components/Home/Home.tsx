import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Team } from '@/contracts/Team';
import type { TeamSummary } from '@/contracts/TeamSummary';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';

import { AppContainer } from '../AppContainer/AppContainer';
import { NextRaceCard } from './NextRaceCard';

interface HomeProps {
  name: string;
  team: Team | null;
  summary: TeamSummary | null;
  standings: MyLeagueStanding[];
  races: RaceWeekend[];
}

const EM_DASH = '—';

const rowBase =
  'grid w-full items-baseline gap-3 grid-cols-[--spacing(8)_1fr_--spacing(13)] md:items-center md:grid-cols-[--spacing(13)_1fr_--spacing(18)_--spacing(24)_--spacing(9)] text-left transition-colors';
const rowChrome =
  'rounded-[0.65rem] border bg-card p-3 md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:px-4 md:py-3';
const rowHover = 'md:hover:bg-accent';
const rowFocus = 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

export function Home({ name, team, summary, standings, races }: HomeProps) {
  return (
    <AppContainer maxWidth="lg" className="py-4 md:py-6">
      <div className="flex flex-col gap-4 md:gap-6">
        <header>
          {team ? (
            <>
              <p className="text-muted-foreground text-xs md:text-sm">Welcome back, {name}</p>
              <h2 className="text-foreground truncate text-xl font-bold tracking-tight md:text-2xl">
                {team.name}
              </h2>
            </>
          ) : (
            <h2 className="text-foreground truncate text-xl font-bold tracking-tight md:text-2xl">
              Welcome, {name}
            </h2>
          )}
        </header>

        <NextRaceCard races={races} />

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          <ScoreCard
            eyebrow="Last race stats"
            title={summary?.lastRace?.name ?? EM_DASH}
            score={summary?.lastRace?.totalScore ?? null}
          />
          <ScoreCard
            eyebrow="Season stats"
            title="Total"
            score={summary?.seasonTotalPoints ?? null}
          />
        </div>

        {standings.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-foreground text-base font-bold tracking-tight md:text-lg">
                My leagues
              </h3>
              <Link
                to="/leagues"
                className="text-primary text-xs font-medium hover:underline md:text-sm"
              >
                View all <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:border-border md:bg-card md:overflow-hidden md:rounded-[0.65rem] md:border">
              <div
                className="text-muted-foreground grid grid-cols-[--spacing(8)_1fr_--spacing(13)] items-center gap-3 px-3 pb-2 text-xs font-semibold tracking-wider uppercase md:hidden"
                aria-hidden="true"
              >
                <div className="text-center">Pos</div>
                <div>League</div>
                <div className="text-right">Pts</div>
              </div>
              <div
                className="text-muted-foreground bg-secondary border-border hidden grid-cols-[--spacing(13)_1fr_--spacing(18)_--spacing(24)_--spacing(9)] items-center gap-3 border-b px-4 py-2.5 text-xs font-semibold tracking-wider uppercase md:grid"
                aria-hidden="true"
              >
                <div className="text-center">Pos</div>
                <div>League</div>
                <div className="text-center">Move</div>
                <div className="text-right">Pts</div>
                <div />
              </div>
              <ul
                role="list"
                aria-label="My leagues"
                className="flex flex-col gap-2 md:gap-0 md:[&>li:last-child>a]:border-b-0"
              >
                {standings.map((entry) => (
                  <li key={entry.leagueId}>
                    <Link
                      to="/league/$leagueId"
                      params={{ leagueId: String(entry.leagueId) }}
                      className={cn(rowBase, rowChrome, rowHover, rowFocus)}
                      aria-label={`Open ${entry.leagueName}`}
                    >
                      <div className="flex items-center justify-center">
                        <span className="text-foreground font-mono text-sm font-semibold tabular-nums md:text-base">
                          {entry.position ?? EM_DASH}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-foreground truncate text-sm font-semibold">
                          {entry.leagueName}
                        </div>
                      </div>
                      <div className="hidden md:block" />
                      <div className="text-foreground text-right font-mono text-sm font-semibold tabular-nums">
                        {entry.totalPoints != null ? entry.totalPoints.toLocaleString() : EM_DASH}
                      </div>
                      <div className="text-muted-foreground hidden justify-center md:flex">
                        <ChevronRightIcon className="size-4" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </AppContainer>
  );
}

interface ScoreCardProps {
  eyebrow: string;
  title: string;
  score: number | null;
}

function ScoreCard({ eyebrow, title, score }: ScoreCardProps) {
  return (
    <div className="bg-card rounded-[0.65rem] border p-4">
      <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
        {eyebrow}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-foreground min-w-0 truncate text-base font-bold tracking-tight md:text-lg">
          {title}
        </p>
        <div className="text-foreground shrink-0 font-mono text-2xl font-bold tabular-nums md:text-2xl">
          {score != null ? score.toLocaleString() : EM_DASH}
          {score != null && (
            <span className="text-muted-foreground ml-1 text-xs font-semibold md:text-sm">pts</span>
          )}
        </div>
      </div>
    </div>
  );
}
