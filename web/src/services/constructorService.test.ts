import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
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
      const mockConstructors: Constructor[] = [
        {
          id: 1,
          type: 'constructor',
          name: 'Red Bull',
          fullName: 'Oracle Red Bull Racing',
          countryAbbreviation: 'AT',
        },
        {
          id: 2,
          type: 'constructor',
          name: 'Mercedes',
          fullName: 'Mercedes-AMG Petronas F1 Team',
          countryAbbreviation: 'DE',
        },
      ];

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
