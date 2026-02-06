export interface Race {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  location: string;
  circuit: string;
  country: string;
  raceDate: string;
  lockDeadline: string | null;
  isCurrent: boolean;
}
