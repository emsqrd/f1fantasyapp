import type { LeagueInvite } from '@/contracts/LeagueInvite';
import { apiClient } from '@/lib/api';

export async function getOrCreateLeagueInvite(leagueId: number): Promise<LeagueInvite | null> {
  const leagueInvite = await apiClient.post<LeagueInvite, string>(`/leagues/${leagueId}/invite`);

  return leagueInvite;
}
