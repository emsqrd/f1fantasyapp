import type { RaceWeekend } from '@/contracts/RaceWeekend';
import { apiClient } from '@/lib/api';
import type { ApiError } from '@/utils/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRaceWeekend, getRaceWeekends } from './raceWeekendService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

function createMockRaceWeekend(overrides: Partial<RaceWeekend> = {}): RaceWeekend {
  return {
    id: 1,
    seasonId: 1,
    round: 1,
    name: 'Bahrain Grand Prix',
    circuit: {
      id: 1,
      name: 'Bahrain International Circuit',
      location: 'Sakhir',
      country: 'Bahrain',
    },
    raceDate: '2026-03-22T15:00:00Z',
    lockDeadline: '2026-03-22T14:00:00Z',
    isCurrent: false,
    weekendFormat: 0,
    ...overrides,
  };
}

describe('raceWeekendService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRaceWeekends', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const seasonId = 1;
      const mockRaceWeekends: RaceWeekend[] = [
        createMockRaceWeekend(),
        createMockRaceWeekend({ id: 2, round: 2, name: 'Saudi Arabian Grand Prix' }),
      ];

      mockApiClient.get.mockResolvedValue(mockRaceWeekends);

      const result = await getRaceWeekends(seasonId);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/seasons/1/race-weekends',
        'get race weekends',
      );
      expect(result).toEqual(mockRaceWeekends);
    });

    it('returns empty array when no race weekends exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getRaceWeekends(1);

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/seasons/1/race-weekends',
        'get race weekends',
      );
    });

    it('propagates API errors', async () => {
      const mockError = new Error('Server error');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getRaceWeekends(1)).rejects.toThrow('Server error');
    });
  });

  describe('getRaceWeekend', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const mockRaceWeekend = createMockRaceWeekend({ id: 5, round: 5 });

      mockApiClient.get.mockResolvedValue(mockRaceWeekend);

      const result = await getRaceWeekend(1, 5);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/seasons/1/race-weekends/5',
        'get race weekend',
      );
      expect(result).toEqual(mockRaceWeekend);
    });

    it('returns null when race weekend is not found (404 error)', async () => {
      const notFoundError: ApiError = Object.assign(new Error('Not found'), { status: 404 });

      mockApiClient.get.mockRejectedValue(notFoundError);

      const result = await getRaceWeekend(1, 999);

      expect(result).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const serverError: ApiError = Object.assign(new Error('Server error'), { status: 500 });

      mockApiClient.get.mockRejectedValue(serverError);

      await expect(getRaceWeekend(1, 1)).rejects.toMatchObject({
        message: 'Server error',
        status: 500,
      });
    });
  });
});
