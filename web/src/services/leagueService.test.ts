import type { CreateLeagueRequest } from '@/contracts/CreateLeagueRequest';
import type { League } from '@/contracts/League';
import { apiClient } from '@/lib/api';
import { createMockLeague, createMockLeagueList } from '@/test-utils/mockFactories';
import type { ApiError } from '@/utils/errors';
import * as Sentry from '@sentry/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLeague,
  getLeagueById,
  getLeagues,
  getMyLeagues,
  getPublicLeagues,
  joinLeague,
} from './leagueService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@sentry/react', () => ({
  logger: {
    info: vi.fn(),
    fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
  },
}));

const mockApiClient = vi.mocked(apiClient);
const mockSentryLogger = vi.mocked(Sentry.logger);

describe('leagueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLeague', () => {
    it('calls apiClient.post with correct endpoint and data', async () => {
      const mockLeagueRequest: CreateLeagueRequest = {
        name: 'Test League',
        description: 'A test league for testing',
        isPrivate: false,
      };

      const mockLeagueResponse: League = createMockLeague();

      mockApiClient.post.mockResolvedValue(mockLeagueResponse);

      const result = await createLeague(mockLeagueRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/leagues',
        mockLeagueRequest,
        'create league',
      );
      expect(result).toEqual(mockLeagueResponse);
    });

    it('logs league creation event with correct context', async () => {
      const mockLeagueRequest: CreateLeagueRequest = {
        name: 'League 1',
        description: 'Test League Description',
        isPrivate: true,
      };

      const mockLeagueResponse: League = createMockLeague();

      mockApiClient.post.mockResolvedValue(mockLeagueResponse);

      await createLeague(mockLeagueRequest);

      expect(mockSentryLogger.info).toHaveBeenCalledWith('League created', {
        leagueId: 1,
        leagueName: 'League 1',
        isPrivate: true,
      });
    });

    it('propagates API errors during league creation', async () => {
      const mockLeagueRequest: CreateLeagueRequest = {
        name: 'Test League',
        description: 'Another test league',
        isPrivate: true,
      };
      const mockError = new Error('Network error');

      mockApiClient.post.mockRejectedValue(mockError);

      await expect(createLeague(mockLeagueRequest)).rejects.toThrow('Network error');
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/leagues',
        mockLeagueRequest,
        'create league',
      );
    });
  });

  describe('getLeagues', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const mockLeagues: League[] = createMockLeagueList(2);

      mockApiClient.get.mockResolvedValue(mockLeagues);

      const result = await getLeagues();

      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues', 'get leagues');
      expect(result).toEqual(mockLeagues);
    });

    it('returns empty array when no leagues exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getLeagues();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues', 'get leagues');
    });

    it('propagates API errors during league retrieval', async () => {
      const mockError = new Error('Server error');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getLeagues()).rejects.toThrow('Server error');
      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues', 'get leagues');
    });
  });

  describe('getMyLeagues', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const mockLeagues: League[] = createMockLeagueList(1);

      mockApiClient.get.mockResolvedValue(mockLeagues);

      const result = await getMyLeagues();

      expect(mockApiClient.get).toHaveBeenCalledWith('/me/leagues', 'get your leagues');
      expect(result).toEqual(mockLeagues);
    });

    it('returns empty array when user has no leagues', async () => {
      mockApiClient.get.mockResolvedValue([]);

      const result = await getMyLeagues();

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalledWith('/me/leagues', 'get your leagues');
    });

    it('propagates API errors during user leagues retrieval', async () => {
      const mockError = new Error('Unauthorized');

      mockApiClient.get.mockRejectedValue(mockError);

      await expect(getMyLeagues()).rejects.toThrow('Unauthorized');
      expect(mockApiClient.get).toHaveBeenCalledWith('/me/leagues', 'get your leagues');
    });
  });

  describe('getLeagueById', () => {
    it('calls apiClient.get with correct endpoint and id', async () => {
      const mockLeague: League = createMockLeague();

      mockApiClient.get.mockResolvedValue(mockLeague);

      const result = await getLeagueById(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues/1', 'get league');
      expect(result).toEqual(mockLeague);
    });

    it('returns null when league is not found (404 error)', async () => {
      const notFoundError: ApiError = Object.assign(new Error('Not found'), {
        status: 404,
      });

      mockApiClient.get.mockRejectedValue(notFoundError);

      const result = await getLeagueById(999);

      expect(result).toBeNull();
      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues/999', 'get league');
    });

    it('propagates non-404 errors during league retrieval', async () => {
      const serverError: ApiError = Object.assign(new Error('Server error'), {
        status: 500,
      });

      mockApiClient.get.mockRejectedValue(serverError);

      await expect(getLeagueById(1)).rejects.toMatchObject({
        message: 'Server error',
        status: 500,
      });
      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues/1', 'get league');
    });
  });

  describe('getPublicLeagues', () => {
    it('calls apiClient.get with correct endpoint when no search term provided', async () => {
      const mockLeagues: League[] = createMockLeagueList(3, (i) => ({
        isPrivate: false,
        name: `Public League ${i}`,
      }));

      mockApiClient.get.mockResolvedValue(mockLeagues);

      const result = await getPublicLeagues();

      expect(mockApiClient.get).toHaveBeenCalledWith('/leagues/public', 'get public leagues');
      expect(result).toEqual(mockLeagues);
    });

    it('calls apiClient.get with search query parameter when search term provided', async () => {
      const mockLeagues: League[] = createMockLeagueList(2, () => ({
        isPrivate: false,
        name: 'Formula League',
      }));

      mockApiClient.get.mockResolvedValue(mockLeagues);

      const result = await getPublicLeagues('Formula');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/leagues/public?search=Formula',
        'get public leagues',
      );
      expect(result).toEqual(mockLeagues);
    });
  });

  describe('joinLeague', () => {
    it('calls apiClient.post with correct endpoint and league id', async () => {
      const mockLeague: League = createMockLeague({
        id: 42,
        name: 'F1 Enthusiasts',
        isPrivate: false,
      });

      mockApiClient.post.mockResolvedValue(mockLeague);

      const result = await joinLeague(42);

      expect(mockApiClient.post).toHaveBeenCalledWith('/leagues/42/join', undefined, 'join league');
      expect(result).toEqual(mockLeague);
    });

    it('does not log to Sentry when join fails', async () => {
      const mockError = new Error('Already in league');

      mockApiClient.post.mockRejectedValue(mockError);

      await expect(joinLeague(1)).rejects.toThrow();
      expect(mockSentryLogger.info).not.toHaveBeenCalled();
    });
  });
});
