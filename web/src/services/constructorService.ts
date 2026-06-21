import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { queryOptions } from '@tanstack/react-query';

export function getConstructors(seasonYear?: number): Promise<Constructor[]> {
  const url = seasonYear ? `/constructors?seasonYear=${seasonYear}` : '/constructors';
  return apiClient.get<Constructor[]>(url, 'get constructors');
}

export const constructorQueries = {
  all: ['constructors'] as const,
  list: (seasonYear?: number) =>
    queryOptions({
      queryKey: [...constructorQueries.all, 'list', seasonYear ?? null] as const,
      queryFn: () => getConstructors(seasonYear),
      staleTime: 5 * 60_000,
    }),
};
