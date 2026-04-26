import type { Constructor } from '@/contracts/Role';
import { apiClient } from '@/lib/api';
import { createMockConstructorList } from '@/tests/test-utils/mockFactories';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getConstructors } from './constructorService';

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

  describe('getConstructors', () => {
    it('calls apiClient.get with default endpoint when no season year provided', async () => {
      const mockConstructors: Constructor[] = createMockConstructorList([
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
      ]);

      mockApiClient.get.mockResolvedValue(mockConstructors);

      const result = await getConstructors();

      expect(mockApiClient.get).toHaveBeenCalledWith('/constructors', 'get constructors');
      expect(result).toEqual(mockConstructors);
    });

    it('calls apiClient.get with seasonYear query parameter when provided', async () => {
      mockApiClient.get.mockResolvedValue([]);

      await getConstructors(2026);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/constructors?seasonYear=2026',
        'get constructors',
      );
    });

    it('returns empty array when no constructors exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getConstructors();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith('/constructors', 'get constructors');
    });

    it('propagates API errors during constructor retrieval', async () => {
      const mockError = new Error('Failed to fetch constructors');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getConstructors()).rejects.toThrow('Failed to fetch constructors');
      expect(mockApiClient.get).toHaveBeenCalledWith('/constructors', 'get constructors');
    });
  });
});
