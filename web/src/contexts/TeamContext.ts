import { createContext } from 'react';

export interface TeamContextType {
  myTeamId: number | null;
  hasTeam: boolean;
  setMyTeamId: (id: number | null) => void;
  refreshMyTeam: () => Promise<void>;
}

export const TeamContext = createContext<TeamContextType | undefined>(undefined);
