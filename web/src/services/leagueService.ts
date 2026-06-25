import type { CreateLeagueRequest } from '@/contracts/CreateLeagueRequest';
import type { League } from '@/contracts/League';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/utils/errors';
import * as Sentry from '@sentry/react';
import { queryOptions } from '@tanstack/react-query';

export async function createLeague(data: CreateLeagueRequest): Promise<League> {
  const league = await apiClient.post<League, CreateLeagueRequest>(
    '/leagues',
    data,
    'create league',
  );

  // INFO - significant business event
  Sentry.logger.info('League created', {
    leagueId: league.id,
    leagueName: league.name,
    isPrivate: league.isPrivate,
  });

  return league;
}

export async function getMyLeagues(): Promise<League[]> {
  return apiClient.get<League[]>('/me/leagues', 'get your leagues');
}

export async function getLeagueById(id: number): Promise<League | null> {
  try {
    return await apiClient.get<League>(`/leagues/${id}`, 'get league');
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getAvailableLeagues(searchTerm?: string): Promise<League[]> {
  const params = new URLSearchParams();

  if (searchTerm) {
    params.append('search', searchTerm);
  }

  const endpoint = `/leagues/available${params.toString() ? `?${params.toString()}` : ''}`;
  return apiClient.get<League[]>(endpoint, 'get available leagues');
}

export async function joinLeague(leagueId: number): Promise<League> {
  const joinedLeague = await apiClient.post<League>(
    `/leagues/${leagueId}/join`,
    undefined,
    'join league',
  );

  Sentry.logger.info('Joined league', {
    leagueId: joinedLeague.id,
    leagueName: joinedLeague.name,
  });

  return joinedLeague;
}

export const leagueQueries = {
  all: ['leagues'] as const,
  mine: () =>
    queryOptions({
      queryKey: [...leagueQueries.all, 'mine'] as const,
      queryFn: getMyLeagues,
    }),
  available: (searchTerm?: string) =>
    queryOptions({
      queryKey: [...leagueQueries.all, 'available', searchTerm ?? null] as const,
      queryFn: () => getAvailableLeagues(searchTerm),
    }),
  byId: (id: number) =>
    queryOptions({
      queryKey: [...leagueQueries.all, 'detail', id] as const,
      queryFn: () => getLeagueById(id),
    }),
};
