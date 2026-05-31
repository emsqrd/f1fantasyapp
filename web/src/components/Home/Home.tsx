import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { Team } from '@/contracts/Team';
import type { TeamSummary } from '@/contracts/TeamSummary';

import { AppContainer } from '../AppContainer/AppContainer';
import { CreateTeamHero } from './CreateTeamHero';
import { JoinLeaguesPrompt } from './JoinLeaguesPrompt';
import { LeaguesNeedTeamNotice } from './LeaguesNeedTeamNotice';
import { MyLeaguesList } from './MyLeaguesList';
import { NextRaceCard } from './NextRaceCard';

interface HomeProps {
  name: string;
  team: Team | null;
  summary: TeamSummary | null;
  standings: MyLeagueStanding[];
  races: RaceWeekend[];
}

const EM_DASH = '—';

export function Home({ name, team, summary, standings, races }: HomeProps) {
  return (
    <AppContainer maxWidth="md" className="py-4 md:py-6">
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

        {!team && <CreateTeamHero />}

        <NextRaceCard races={races} />

        {team && (
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
        )}

        {!team ? (
          <LeaguesNeedTeamNotice />
        ) : standings.length === 0 ? (
          <JoinLeaguesPrompt />
        ) : (
          <MyLeaguesList standings={standings} />
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
