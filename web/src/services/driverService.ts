import type { Driver } from '@/contracts/Role';
import { apiClient } from '@/lib/api';

export async function getActiveDrivers(): Promise<Driver[]> {
  return apiClient.get<Driver[]>('/drivers?activeOnly=true', 'get drivers');
}
