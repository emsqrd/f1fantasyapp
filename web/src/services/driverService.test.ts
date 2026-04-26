import type { Driver } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { createMockDriverList } from '@/tests/test-utils/mockFactories';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDrivers } from './driverService';

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

  describe('getDrivers', () => {
    it('calls apiClient.get with default endpoint when no season year provided', async () => {
      const mockDrivers: Driver[] = createMockDriverList([
        {
          firstName: 'Max',
          lastName: 'Verstappen',
          abbreviation: 'VER',
          countryAbbreviation: 'NED',
        },
        {
          firstName: 'Lewis',
          lastName: 'Hamilton',
          abbreviation: 'HAM',
          countryAbbreviation: 'GBR',
        },
      ]);

      mockApiClient.get.mockResolvedValue(mockDrivers);

      const result = await getDrivers();

      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers', 'get drivers');
      expect(result).toEqual(mockDrivers);
    });

    it('calls apiClient.get with seasonYear query parameter when provided', async () => {
      mockApiClient.get.mockResolvedValue([]);

      await getDrivers(2026);

      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers?seasonYear=2026', 'get drivers');
    });

    it('returns empty array when no drivers exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getDrivers();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers', 'get drivers');
    });

    it('propagates API errors during driver retrieval', async () => {
      const mockError = new Error('Failed to fetch drivers');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getDrivers()).rejects.toThrow('Failed to fetch drivers');
      expect(mockApiClient.get).toHaveBeenCalledWith('/drivers', 'get drivers');
    });
  });
});
