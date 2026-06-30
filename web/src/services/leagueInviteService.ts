import type { League } from '@/contracts/League';
import type { LeagueInvite } from '@/contracts/LeagueInvite';
import type { LeagueInvitePreviewResponse } from '@/contracts/LeagueInvitePreviewResponse';
import { apiClient } from '@/lib/api';
import { queryOptions } from '@tanstack/react-query';

export async function getOrCreateLeagueInvite(leagueId: number): Promise<LeagueInvite | null> {
  return await apiClient.post<LeagueInvite, string>(`/leagues/${leagueId}/invite`);
}

export async function previewInvite(token: string): Promise<LeagueInvitePreviewResponse | null> {
  return await apiClient.get<LeagueInvitePreviewResponse>(`/leagues/join/${token}/preview`);
}

export async function joinViaInvite(token: string): Promise<League | null> {
  return await apiClient.post<League, string>(`/leagues/join/${token}`);
}

export const leagueInviteQueries = {
  all: ['leagueInvite'] as const,
  preview: (token: string) =>
    queryOptions({
      queryKey: [...leagueInviteQueries.all, 'preview', token] as const,
      queryFn: () => previewInvite(token),
    }),
};
