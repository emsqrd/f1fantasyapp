import type { League } from '@/contracts/League';
import type { LeagueStandings } from '@/contracts/LeagueStandings';
import { sessionTypeLabel } from '@/contracts/LeagueStandings';

interface LeaderboardHeaderProps {
  league: League;
  standings: LeagueStandings;
}

const chipClasses =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-secondary px-2.5 py-1 font-medium tabular-nums text-secondary-foreground';

const chipRowMobile =
  '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const chipRowDesktop = 'sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0';

export function LeaderboardHeader({ league, standings }: LeaderboardHeaderProps) {
  const showRoundChip = standings.currentRound != null;
  const showAfterChip = standings.afterRaceWeekendName != null;
  const sessionLabel =
    standings.afterSessionType != null ? sessionTypeLabel[standings.afterSessionType] : null;
  const showAnyChip = showRoundChip || showAfterChip;

  return (
    <div className="pb-5">
      <h1 className="text-foreground text-[24px] font-bold tracking-tight sm:text-[28px]">
        {league.name}
      </h1>
      {league.description && (
        <p className="text-muted-foreground mt-1 max-w-[52ch] text-[13px] leading-relaxed">
          {league.description}
        </p>
      )}
      {showAnyChip && (
        <div
          className={`mt-3 flex items-center gap-1.5 text-[12px] ${chipRowMobile} ${chipRowDesktop}`}
        >
          {showRoundChip && (
            <span className={chipClasses}>
              Round {standings.currentRound}{' '}
              <span className="text-muted-foreground">/ {standings.totalRounds}</span>
            </span>
          )}
          {showAfterChip && (
            <span className={chipClasses}>
              <span className="text-muted-foreground">After</span>
              {standings.afterRaceWeekendName}
              {sessionLabel && (
                <>
                  <span className="text-muted-foreground">·</span>
                  {sessionLabel}
                </>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
