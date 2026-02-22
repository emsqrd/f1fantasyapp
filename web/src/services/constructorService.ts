import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';

export function getConstructors(seasonYear?: number): Promise<Constructor[]> {
  const url = seasonYear ? `/constructors?seasonYear=${seasonYear}` : '/constructors';
  return apiClient.get<Constructor[]>(url, 'get constructors');
}
