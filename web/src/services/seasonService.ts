import type { Season } from '@/contracts/Season';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/utils/errors';

export async function getCurrentSeason(): Promise<Season | null> {
  try {
    return await apiClient.get<Season>('/seasons/current', 'get current season');
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}
