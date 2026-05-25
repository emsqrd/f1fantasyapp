import type { LeagueStandings } from '@/contracts/LeagueStandings';
import type { MyLeagueStanding } from '@/contracts/MyLeagueStanding';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/utils/errors';

export async function getLeagueStandings(leagueId: number): Promise<LeagueStandings | null> {
  try {
    return await apiClient.get<LeagueStandings>(
      `/leagues/${leagueId}/standings`,
      'get league standings',
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getMyStandings(): Promise<MyLeagueStanding[]> {
  return await apiClient.get<MyLeagueStanding[]>('/me/standings', 'get your league standings');
}
