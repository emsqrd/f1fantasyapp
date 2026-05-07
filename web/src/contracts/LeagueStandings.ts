export interface TeamLeagueStanding {
  teamId: number;
  teamName: string;
  ownerId: number;
  ownerName: string;
  position: number;
  totalPoints: number;
  positionChange: number | null;
}

export interface LeagueStandings {
  leagueId: number;
  lastScoredRound: number | null;
  lastScoredRaceWeekendName: string | null;
  standings: TeamLeagueStanding[];
}
