import type { Season } from '@/contracts/Season';
import { apiClient } from '@/lib/api';
import type { ApiError } from '@/utils/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentSeason } from './seasonService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

function createMockSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 1,
    year: 2026,
    startDate: '2026-03-16T00:00:00Z',
    endDate: '2026-12-07T00:00:00Z',
    isCurrent: true,
    ...overrides,
  };
}

describe('seasonService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentSeason', () => {
    it('returns the current season when one exists', async () => {
      const mockSeason = createMockSeason();

      mockApiClient.get.mockResolvedValue(mockSeason);

      const result = await getCurrentSeason();

      expect(mockApiClient.get).toHaveBeenCalledWith('/seasons/current', 'get current season');
      expect(result).toEqual(mockSeason);
    });

    it('returns null when no active season exists (404 error)', async () => {
      const notFoundError: ApiError = Object.assign(new Error('Not found'), { status: 404 });

      mockApiClient.get.mockRejectedValue(notFoundError);

      const result = await getCurrentSeason();

      expect(result).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const serverError: ApiError = Object.assign(new Error('Server error'), { status: 500 });

      mockApiClient.get.mockRejectedValue(serverError);

      await expect(getCurrentSeason()).rejects.toMatchObject({
        message: 'Server error',
        status: 500,
      });
    });
  });
});
