import type { RaceWeekend } from '@/contracts/RaceWeekend';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/utils/errors';

export async function getRaceWeekends(seasonId: number): Promise<RaceWeekend[]> {
  return apiClient.get<RaceWeekend[]>(`/seasons/${seasonId}/race-weekends`, 'get race weekends');
}

export async function getRaceWeekend(seasonId: number, round: number): Promise<RaceWeekend | null> {
  try {
    return await apiClient.get<RaceWeekend>(
      `/seasons/${seasonId}/race-weekends/${round}`,
      'get race weekend',
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}
