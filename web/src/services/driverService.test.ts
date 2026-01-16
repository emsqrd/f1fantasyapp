import type { Driver } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getActiveDrivers } from './driverService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('driverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveDrivers', () => {
    it('calls apiClient.get with correct endpoint and query parameter', async () => {
      const mockDrivers: Driver[] = [
        {
          id: 1,
          type: 'driver',
          firstName: 'Max',
          lastName: 'Verstappen',
          countryAbbreviation: 'NL',
        },
        {
          id: 2,
          type: 'driver',
          firstName: 'Lewis',
          lastName: 'Hamilton',
          countryAbbreviation: 'GB',
        },
      ];

      mockApiClient.get.mockResolvedValue(mockDrivers);

      const result = await getActiveDrivers();

      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers?activeOnly=true', 'get drivers');
      expect(result).toEqual(mockDrivers);
    });

    it('returns empty array when no active drivers exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getActiveDrivers();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers?activeOnly=true', 'get drivers');
    });

    it('propagates API errors during driver retrieval', async () => {
      const mockError = new Error('Failed to fetch drivers');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getActiveDrivers()).rejects.toThrow('Failed to fetch drivers');
      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers?activeOnly=true', 'get drivers');
    });
  });
});
