import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';

export function getActiveConstructors(): Promise<Constructor[]> {
  return apiClient.get<Constructor[]>('/constructors?activeOnly=true', 'get constructors');
}
