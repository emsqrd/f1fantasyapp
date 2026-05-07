import type { LeagueStandings } from '@/contracts/LeagueStandings';
import { apiClient } from '@/lib/api';
import { createMockLeagueStandings } from '@/tests/test-utils/mockFactories';
import type { ApiError } from '@/utils/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLeagueStandings } from './standingsService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('standingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLeagueStandings', () => {
    it('calls apiClient.get with correct endpoint and id', async () => {
      const mockStandings: LeagueStandings = createMockLeagueStandings();

      mockApiClient.get.mockResolvedValue(mockStandings);

      const result = await getLeagueStandings(1);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/leagues/1/standings',
        'get league standings',
      );
      expect(result).toEqual(mockStandings);
    });

    it('returns null when standings are not found (404 error)', async () => {
      const notFoundError: ApiError = Object.assign(new Error('Not found'), {
        status: 404,
      });

      mockApiClient.get.mockRejectedValue(notFoundError);

      const result = await getLeagueStandings(999);

      expect(result).toBeNull();
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/leagues/999/standings',
        'get league standings',
      );
    });

    it('propagates non-404 errors during standings retrieval', async () => {
      const serverError: ApiError = Object.assign(new Error('Server error'), {
        status: 500,
      });

      mockApiClient.get.mockRejectedValue(serverError);

      await expect(getLeagueStandings(1)).rejects.toMatchObject({
        message: 'Server error',
        status: 500,
      });
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/leagues/1/standings',
        'get league standings',
      );
    });
  });
});
