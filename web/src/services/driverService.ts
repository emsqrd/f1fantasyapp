import type { Driver } from '@/contracts/Role';
import { apiClient } from '@/lib/api';

export async function getDrivers(seasonYear?: number): Promise<Driver[]> {
  const url = seasonYear ? `/drivers?seasonYear=${seasonYear}` : '/drivers';
  return apiClient.get<Driver[]>(url, 'get drivers');
}
