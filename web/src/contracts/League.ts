import type { Team } from './Team';

export interface League {
  id: number;
  name: string;
  description: string;
  teamCount: number;
  maxTeams: number;
  isPrivate: boolean;
  ownerId: number;
  ownerName: string;
  teams: Team[];
}
