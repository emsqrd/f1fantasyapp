import type { Driver } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { queryOptions } from '@tanstack/react-query';

export async function getDrivers(seasonYear?: number): Promise<Driver[]> {
  const url = seasonYear ? `/drivers?seasonYear=${seasonYear}` : '/drivers';
  return apiClient.get<Driver[]>(url, 'get drivers');
}

export const driverQueries = {
  all: ['drivers'] as const,
  list: (seasonYear?: number) =>
    queryOptions({
      queryKey: [...driverQueries.all, 'list', seasonYear ?? null] as const,
      queryFn: () => getDrivers(seasonYear),
    }),
};
