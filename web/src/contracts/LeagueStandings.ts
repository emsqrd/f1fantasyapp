export interface StandingsEntry {
  teamId: number;
  teamName: string;
  ownerId: number;
  ownerName: string;
  position: number;
  totalPoints: number;
  positionChange: number | null;
}

export const SessionType = {
  GrandPrix: 0,
  Sprint: 1,
  Qualifying: 2,
} as const;
export type SessionType = (typeof SessionType)[keyof typeof SessionType];

export interface LeagueStandings {
  leagueId: number;
  currentRound: number | null;
  totalRounds: number;
  afterRaceWeekendName: string | null;
  afterSessionType: SessionType | null;
  standings: StandingsEntry[];
}

export const sessionTypeLabel: Record<SessionType, string | null> = {
  [SessionType.Sprint]: 'Sprint',
  [SessionType.Qualifying]: 'Qualifying',
  [SessionType.GrandPrix]: null,
};
