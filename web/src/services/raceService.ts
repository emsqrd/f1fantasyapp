import type { Race } from '@/contracts/Race';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/utils/errors';

export async function getRaces(): Promise<Race[]> {
  return apiClient.get<Race[]>('/races', 'get races');
}

export async function getRaceById(id: number): Promise<Race | null> {
  try {
    return await apiClient.get<Race>(`/races/${id}`, 'get race');
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}
