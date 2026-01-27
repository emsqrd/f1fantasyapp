import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateLeagueInvite, previewInvite, joinViaInvite } from './leagueInviteService';
import { apiClient } from '@/lib/api';
import { createMockLeague } from '@/test-utils/mockFactories';
import type { LeagueInvite } from '@/contracts/LeagueInvite';
import type { LeagueInvitePreviewResponse } from '@/contracts/LeagueInvitePreviewResponse';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('leagueInviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateLeagueInvite', () => {
    it('should return league invite when successful', async () => {
      const mockInvite: LeagueInvite = {
        id: 1,
        leagueId: 123,
        token: 'abc123xyz',
        shareableUrl: 'http://localhost:5173/leagues/join/abc123xyz',
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockInvite);

      const result = await getOrCreateLeagueInvite(123);

      expect(apiClient.post).toHaveBeenCalledWith('/leagues/123/invite');
      expect(result).toEqual(mockInvite);
    });

    it('should return null when API returns null', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(null);

      const result = await getOrCreateLeagueInvite(123);

      expect(result).toBeNull();
    });

    it('should throw error when API request fails', async () => {
      const error = new Error('Network error');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(getOrCreateLeagueInvite(123)).rejects.toThrow('Network error');
    });
  });

  describe('previewInvite', () => {
    it('should return preview data when token is valid', async () => {
      const mockPreview: LeagueInvitePreviewResponse = {
        leagueName: 'Test League',
        leagueDescription: 'A test league',
        ownerName: 'John Doe',
        currentTeamCount: 5,
        maxTeams: 10,
        isLeagueFull: false,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockPreview);

      const result = await previewInvite('abc123xyz');

      expect(apiClient.get).toHaveBeenCalledWith('/leagues/join/abc123xyz/preview');
      expect(result).toEqual(mockPreview);
    });

    it('should return null when token is invalid', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(null);

      const result = await previewInvite('invalid-token');

      expect(result).toBeNull();
    });

    it('should throw error when API request fails', async () => {
      const error = new Error('Server error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(previewInvite('abc123xyz')).rejects.toThrow('Server error');
    });
  });

  describe('joinViaInvite', () => {
    it('should return league when join is successful', async () => {
      const mockLeague = createMockLeague({
        id: 123,
        name: 'Test League',
        description: 'A test league',
        ownerName: 'John Doe',
        isPrivate: true,
      });

      vi.mocked(apiClient.post).mockResolvedValue(mockLeague);

      const result = await joinViaInvite('abc123xyz');

      expect(apiClient.post).toHaveBeenCalledWith('/leagues/join/abc123xyz');
      expect(result).toEqual(mockLeague);
    });

    it('should return null when join fails', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(null);

      const result = await joinViaInvite('invalid-token');

      expect(result).toBeNull();
    });

    it('should throw error when API request fails', async () => {
      const error = new Error('Already a member');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(joinViaInvite('abc123xyz')).rejects.toThrow('Already a member');
    });
  });
});
