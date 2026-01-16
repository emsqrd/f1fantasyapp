import type { AddConstructorToTeamRequest } from '@/contracts/AddConstructorToTeamRequest';
import type { AddDriverToTeamRequest } from '@/contracts/AddDriverToTeamRequest';
import type { CreateTeamRequest } from '@/contracts/CreateTeamRequest';
import type { Team } from '@/contracts/Team';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/utils/errors';
import * as Sentry from '@sentry/react';

export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  const team = await apiClient.post<Team, CreateTeamRequest>('/teams', data, 'create team');

  // INFO - significant business event
  Sentry.logger.info('Team created', {
    teamId: team.id,
    teamName: team.name,
  });

  return team;
}

export async function getMyTeam(): Promise<Team | null> {
  try {
    return await apiClient.get<Team>('/me/team', 'get your team');
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getTeams(): Promise<Team[]> {
  return await apiClient.get('/teams', 'get teams');
}

export async function getTeamById(id: number): Promise<Team | null> {
  try {
    return await apiClient.get<Team>(`/teams/${id}`, 'get team');
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function addDriverToTeam(driverId: number, slotPosition: number): Promise<void> {
  const request: AddDriverToTeamRequest = {
    DriverId: driverId,
    SlotPosition: slotPosition,
  };

  await apiClient.post('/me/team/drivers', request, 'add driver to team');

  Sentry.logger.info('Driver added to team', {
    driverId,
    slotPosition,
  });
}

export async function removeDriverFromTeam(slotPosition: number): Promise<void> {
  await apiClient.delete(`/me/team/drivers/${slotPosition}`, 'remove driver from team');

  Sentry.logger.info('Driver removed from team', {
    slotPosition,
  });
}

export async function addConstructorToTeam(
  constructorId: number,
  slotPosition: number,
): Promise<void> {
  const request: AddConstructorToTeamRequest = {
    ConstructorId: constructorId,
    SlotPosition: slotPosition,
  };

  await apiClient.post('/me/team/constructors', request, 'add constructor to team');

  Sentry.logger.info('Constructor added to team', {
    constructorId,
    slotPosition,
  });
}

export async function removeConstructorFromTeam(slotPosition: number): Promise<void> {
  await apiClient.delete(`/me/team/constructors/${slotPosition}`, 'remove constructor from team');

  Sentry.logger.info('Constructor removed from team', {
    slotPosition,
  });
}
