import type { Team } from '@/contracts/Team';
import { setCaptain, teamQueries } from '@/services/teamService';
import { createMockTeam, createMockTeamDriver } from '@/tests/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSetCaptain } from './useSetCaptain';

// Keep `teamQueries` at its production value so the hook's optimistic patch and
// the test's assertions read the same cache key; only the network call is
// stubbed.
vi.mock('@/services/teamService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/teamService')>();
  return { ...actual, setCaptain: vi.fn() };
});

function renderSetCaptain(team: Team | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(teamQueries.mine().queryKey, team);

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { ...renderHook(() => useSetCaptain(), { wrapper }), queryClient };
}

function teamWithCaptain(captainId: number) {
  return createMockTeam({
    drivers: [
      createMockTeamDriver({ id: 1, slotPosition: 0, isCaptain: captainId === 1 }),
      createMockTeamDriver({ id: 2, slotPosition: 1, isCaptain: captainId === 2 }),
    ],
  });
}

describe('useSetCaptain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setCaptain).mockResolvedValue(undefined);
  });

  it('optimistically marks the chosen driver as the only captain', async () => {
    const { result, queryClient } = renderSetCaptain(teamWithCaptain(1));

    act(() => {
      result.current.mutate(2);
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Team>(teamQueries.mine().queryKey)!;
      expect(cached.drivers.find((d) => d.id === 2)?.isCaptain).toBe(true);
    });
    const cached = queryClient.getQueryData<Team>(teamQueries.mine().queryKey)!;
    expect(cached.drivers.find((d) => d.id === 1)?.isCaptain).toBe(false);
  });

  it('clears every captain flag when set to null', async () => {
    const { result, queryClient } = renderSetCaptain(teamWithCaptain(1));

    act(() => {
      result.current.mutate(null);
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Team>(teamQueries.mine().queryKey)!;
      expect(cached.drivers.some((d) => d.isCaptain)).toBe(false);
    });
  });

  it('patches the cache with new team and drivers references', async () => {
    const { result, queryClient } = renderSetCaptain(teamWithCaptain(1));
    const before = queryClient.getQueryData<Team>(teamQueries.mine().queryKey)!;

    act(() => {
      result.current.mutate(2);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<Team>(teamQueries.mine().queryKey)).not.toBe(before);
    });
    const after = queryClient.getQueryData<Team>(teamQueries.mine().queryKey)!;
    expect(after.drivers).not.toBe(before.drivers);
  });

  it('rolls back to the previous team when the request fails', async () => {
    vi.mocked(setCaptain).mockRejectedValueOnce(new Error('nope'));
    const { result, queryClient } = renderSetCaptain(teamWithCaptain(1));

    act(() => {
      result.current.mutate(2);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = queryClient.getQueryData<Team>(teamQueries.mine().queryKey)!;
    expect(cached.drivers.find((d) => d.id === 1)?.isCaptain).toBe(true);
    expect(cached.drivers.find((d) => d.id === 2)?.isCaptain).toBe(false);
  });
});
