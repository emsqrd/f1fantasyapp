import type { Circuit } from './Circuit';

export type WeekendFormat = 0 | 1;

export interface Race {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  circuit: Circuit;
  raceDate: string;
  lockDeadline: string | null;
  isCurrent: boolean;
  weekendFormat: WeekendFormat;
}
