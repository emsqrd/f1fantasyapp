import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { queryOptions } from '@tanstack/react-query';

export function getConstructors(seasonYear?: number): Promise<Constructor[]> {
  const url = seasonYear ? `/constructors?seasonYear=${seasonYear}` : '/constructors';
  return apiClient.get<Constructor[]>(url, 'get constructors');
}

export const constructorKeys = { all: ['constructors'] as const };

export const constructorsQuery = queryOptions({
  queryKey: constructorKeys.all,
  queryFn: () => getConstructors(),
  staleTime: 5 * 60_000,
});
