import type { RaceWeekend } from '@/contracts/RaceWeekend';
import type { TeamSummary } from '@/contracts/TeamSummary';

import { AppContainer } from '../AppContainer/AppContainer';
import { CreateTeamHero } from './CreateTeamHero';
import { LeaguesNeedTeamNotice } from './LeaguesNeedTeamNotice';
import { MyLeaguesList } from './MyLeaguesList';
import { NextRaceCard } from './NextRaceCard';
import { ScoreCard } from './ScoreCard';

interface HomeProps {
  name: string;
  summary: TeamSummary | null;
  races: RaceWeekend[];
}

const EM_DASH = '—';

export function Home({ name, summary, races }: HomeProps) {
  return (
    <AppContainer maxWidth="md" className="py-4 md:py-6">
      <div className="flex flex-col gap-4 md:gap-6">
        <header>
          {summary ? (
            <>
              <p className="text-muted-foreground text-xs md:text-sm">Welcome back, {name}</p>
              <h2 className="text-foreground truncate text-xl font-bold tracking-tight md:text-2xl">
                {summary.teamName}
              </h2>
            </>
          ) : (
            <h2 className="text-foreground truncate text-xl font-bold tracking-tight md:text-2xl">
              Welcome, {name}
            </h2>
          )}
        </header>

        {!summary && <CreateTeamHero />}

        <NextRaceCard races={races} />

        {summary && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
            <ScoreCard
              eyebrow="Last race stats"
              title={summary.lastRace?.name ?? EM_DASH}
              score={summary.lastRace?.totalScore ?? null}
            />
            <ScoreCard
              eyebrow="Season stats"
              title="Total"
              score={summary.seasonTotalPoints ?? null}
            />
          </div>
        )}

        {!summary ? <LeaguesNeedTeamNotice /> : <MyLeaguesList />}
      </div>
    </AppContainer>
  );
}
