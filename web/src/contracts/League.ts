import type { Team } from './Team';

export interface League {
  id: number;
  name: string;
  description: string;
  ownerName: string;
  isPrivate: boolean;
  teams: Team[];
}
