import type { Race } from '@/contracts/Race';
import { apiClient } from '@/lib/api';
import type { ApiError } from '@/utils/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRaceById, getRaces } from './raceService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

function createMockRace(overrides: Partial<Race> = {}): Race {
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
    raceDate: '2025-03-02T15:00:00Z',
    lockDeadline: '2025-03-02T14:00:00Z',
    isCurrent: false,
    weekendFormat: 0,
    ...overrides,
  };
}

describe('raceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRaces', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const mockRaces: Race[] = [
        createMockRace(),
        createMockRace({ id: 2, round: 2, name: 'Saudi Arabian Grand Prix' }),
      ];

      mockApiClient.get.mockResolvedValue(mockRaces);

      const result = await getRaces();

      expect(mockApiClient.get).toHaveBeenCalledWith('/races', 'get races');
      expect(result).toEqual(mockRaces);
    });

    it('returns empty array when no races exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getRaces();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith('/races', 'get races');
    });

    it('propagates API errors during race retrieval', async () => {
      const mockError = new Error('Server error');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getRaces()).rejects.toThrow('Server error');
      expect(mockApiClient.get).toHaveBeenCalledWith('/races', 'get races');
    });
  });

  describe('getRaceById', () => {
    it('calls apiClient.get with correct endpoint and id', async () => {
      const mockRace = createMockRace({ id: 5 });

      mockApiClient.get.mockResolvedValue(mockRace);

      const result = await getRaceById(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/races/5', 'get race');
      expect(result).toEqual(mockRace);
    });

    it('returns null when race is not found (404 error)', async () => {
      const notFoundError: ApiError = Object.assign(new Error('Not found'), {
        status: 404,
      });

      mockApiClient.get.mockRejectedValue(notFoundError);

      const result = await getRaceById(999);

      expect(result).toBeNull();
      expect(mockApiClient.get).toHaveBeenCalledWith('/races/999', 'get race');
    });

    it('propagates non-404 errors during race retrieval', async () => {
      const serverError: ApiError = Object.assign(new Error('Server error'), {
        status: 500,
      });

      mockApiClient.get.mockRejectedValue(serverError);

      await expect(getRaceById(1)).rejects.toMatchObject({
        message: 'Server error',
        status: 500,
      });
      expect(mockApiClient.get).toHaveBeenCalledWith('/races/1', 'get race');
    });

    it('propagates non-API errors without catching them', async () => {
      const genericError = new Error('Network failure');

      mockApiClient.get.mockRejectedValue(genericError);

      await expect(getRaceById(1)).rejects.toThrow('Network failure');
      expect(mockApiClient.get).toHaveBeenCalledWith('/races/1', 'get race');
    });
  });
});
