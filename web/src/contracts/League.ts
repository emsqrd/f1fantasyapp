import type { Team } from './Team';

export interface League {
  id: number;
  name: string;
  description: string;
  teamCount: number;
  maxTeams: number;
  isPrivate: boolean;
  ownerName: string;
  teams: Team[];
}
