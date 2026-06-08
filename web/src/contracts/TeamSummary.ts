export interface TeamSummary {
  teamName: string;
  seasonTotalPoints: number | null;
  lastRace: {
    round: number;
    name: string;
    totalScore: number;
  } | null;
}
