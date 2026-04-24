import { apiFetchJson } from './api';
import type { TestUser } from './auth';

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

export interface SeededLeagueInvite {
  token: string;
  shareableUrl: string;
}

/**
 * Creates (or re-uses) an invite for a league via the real owner-only
 * endpoint. Use when a test needs an invite token up front without
 * driving the owner through the invite dialog UI.
 */
export async function seedLeagueInvite(
  owner: TestUser,
  leagueId: number,
): Promise<SeededLeagueInvite> {
  return apiFetchJson<SeededLeagueInvite>(`/leagues/${leagueId}/invite`, {
    method: 'POST',
    user: owner,
  });
}
