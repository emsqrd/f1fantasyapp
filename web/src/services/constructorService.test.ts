import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { createMockConstructorList } from '@/test-utils/mockFactories';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getActiveConstructors } from './constructorService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('constructorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveConstructors', () => {
    it('calls apiClient.get with correct endpoint and query parameter', async () => {
      const mockConstructors: Constructor[] = createMockConstructorList(5, (i) => {
        const constructorData = [
          {
            name: 'Red Bull Racing',
            fullName: 'Oracle Red Bull Racing',
            abbreviation: 'RBR',
            countryAbbreviation: 'AUT',
          },
          {
            name: 'Mercedes',
            fullName: 'Mercedes-AMG Petronas',
            abbreviation: 'MER',
            countryAbbreviation: 'GER',
          },
        ];
        return constructorData[i - 1];
      });

      mockApiClient.get.mockResolvedValue(mockConstructors);

      const result = await getActiveConstructors();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/constructors?activeOnly=true',
        'get constructors',
      );
      expect(result).toEqual(mockConstructors);
    });

    it('returns empty array when no active constructors exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getActiveConstructors();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/constructors?activeOnly=true',
        'get constructors',
      );
    });

    it('propagates API errors during constructor retrieval', async () => {
      const mockError = new Error('Failed to fetch constructors');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getActiveConstructors()).rejects.toThrow('Failed to fetch constructors');
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/constructors?activeOnly=true',
        'get constructors',
      );
    });
  });
});
