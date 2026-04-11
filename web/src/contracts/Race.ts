export interface Circuit {
  id: number;
  name: string;
  location: string;
  country: string;
}

export interface Race {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  circuit: Circuit;
  raceDate: string;
  lockDeadline: string | null;
  isCurrent: boolean;
}
