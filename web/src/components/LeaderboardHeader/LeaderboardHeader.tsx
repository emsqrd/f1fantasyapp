import type { League } from '@/contracts/League';
import type { LeagueStandings } from '@/contracts/LeagueStandings';
import type { ReactNode } from 'react';

interface LeaderboardHeaderProps {
  league: League;
  standings: LeagueStandings;
  actions?: ReactNode;
}

export function LeaderboardHeader({ league, standings, actions }: LeaderboardHeaderProps) {
  return (
    <div className="pb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {standings.lastScoredRound != null && standings.lastScoredRaceWeekendName != null && (
            <p className="mb-1 text-[12px] font-semibold tracking-[0.14em] text-[color-mix(in_oklab,var(--primary)_70%,var(--muted-foreground))] uppercase">
              Round {standings.lastScoredRound} <span aria-hidden="true">·</span>{' '}
              {standings.lastScoredRaceWeekendName}
            </p>
          )}
          <h1 className="text-foreground text-[24px] font-bold tracking-tight sm:text-[28px]">
            {league.name}
          </h1>
          {league.description && (
            <p className="text-muted-foreground mt-1 max-w-[52ch] text-[13px] leading-relaxed">
              {league.description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
