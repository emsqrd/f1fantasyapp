import type { TestUser } from './auth';
import { apiFetchJson } from './api';

export interface SeededTeam {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
}

export interface SeedTeamForUserOptions {
  name?: string;
  driverIds?: number[];
  constructorIds?: number[];
  captainDriverId?: number;
}

/**
 * Creates a team for the given test user via the real API, then fills roster
 * slots if provided. Each driver/constructor is added through the endpoint the
 * UI hits (`/api/me/team/drivers`, `/api/me/team/constructors`), exercising
 * the same auth + budget path as production.
 */
export async function seedTeamForUser(
  user: TestUser,
  options: SeedTeamForUserOptions = {},
): Promise<SeededTeam> {
  const team = await apiFetchJson<SeededTeam>('/teams', {
    method: 'POST',
    user,
    body: { name: options.name ?? 'Test Team' },
  });

  if (options.driverIds) {
    for (const [index, driverId] of options.driverIds.entries()) {
      await apiFetchJson<unknown>('/me/team/drivers', {
        method: 'POST',
        user,
        body: { driverId, slotPosition: index },
      });
    }
  }

  if (options.constructorIds) {
    for (const [index, constructorId] of options.constructorIds.entries()) {
      await apiFetchJson<unknown>('/me/team/constructors', {
        method: 'POST',
        user,
        body: { constructorId, slotPosition: index },
      });
    }
  }

  if (options.captainDriverId !== undefined) {
    await apiFetchJson<unknown>('/me/team/captain', {
      method: 'PUT',
      user,
      body: { driverId: options.captainDriverId },
    });
  }

  return team;
}
