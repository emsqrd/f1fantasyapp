import type { TestUser } from './auth';
import { apiFetchJson } from './api';

export interface SeededLeague {
  id: number;
  name: string;
  description: string | null;
  teamCount: number;
  maxTeams: number;
  isPrivate: boolean;
  ownerId: number;
  ownerName: string;
}

export interface SeedLeagueOptions {
  name?: string;
  description?: string;
  isPrivate?: boolean;
}

export async function seedLeague(
  owner: TestUser,
  options: SeedLeagueOptions = {},
): Promise<SeededLeague> {
  return apiFetchJson<SeededLeague>('/leagues/', {
    method: 'POST',
    user: owner,
    body: {
      name: options.name ?? 'Test League',
      description: options.description,
      isPrivate: options.isPrivate ?? false,
    },
  });
}
