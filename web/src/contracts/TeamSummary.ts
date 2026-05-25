export interface TeamSummary {
  seasonTotalPoints: number | null;
  lastRace: {
    round: number;
    name: string;
    totalScore: number;
  } | null;
}
