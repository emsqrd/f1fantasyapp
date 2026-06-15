import type { Driver } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { queryOptions } from '@tanstack/react-query';

export async function getDrivers(seasonYear?: number): Promise<Driver[]> {
  const url = seasonYear ? `/drivers?seasonYear=${seasonYear}` : '/drivers';
  return apiClient.get<Driver[]>(url, 'get drivers');
}

export const driverKeys = { all: ['drivers'] as const };

export const driversQuery = queryOptions({
  queryKey: driverKeys.all,
  queryFn: () => getDrivers(),
  staleTime: 5 * 60_000,
});
