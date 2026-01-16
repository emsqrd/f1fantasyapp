import type { AddConstructorToTeamRequest } from '@/contracts/AddConstructorToTeamRequest';
import type { AddDriverToTeamRequest } from '@/contracts/AddDriverToTeamRequest';
import type { CreateTeamRequest } from '@/contracts/CreateTeamRequest';
import type { Team } from '@/contracts/Team';
import { apiClient } from '@/lib/api';
import { createMockTeam } from '@/test-utils';
import type { ApiError } from '@/utils/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addConstructorToTeam,
  addDriverToTeam,
  createTeam,
  getMyTeam,
  getTeamById,
  getTeams,
  removeConstructorFromTeam,
  removeDriverFromTeam,
} from './teamService';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@sentry/react', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('teamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTeam', () => {
    it('calls apiClient.post with correct endpoint and data', async () => {
      const mockRequest: CreateTeamRequest = {
        name: 'Racing Legends',
      };

      const mockResponse: Team = createMockTeam({
        id: 1,
        name: 'Racing Legends',
        ownerName: 'John Doe',
      });

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await createTeam(mockRequest);

      expect(apiClient.post).toHaveBeenCalledWith('/teams', mockRequest, 'create team');
      expect(result).toEqual(mockResponse);
    });

    it('propagates API errors during team creation', async () => {
      const mockRequest: CreateTeamRequest = {
        name: 'Test Team',
      };

      const mockError = new Error('Network failure');

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(createTeam(mockRequest)).rejects.toThrow('Network failure');
    });
  });

  describe('getMyTeam', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const mockTeam: Team = createMockTeam({
        id: 1,
        name: 'My Racing Team',
        ownerName: 'Current User',
      });

      vi.mocked(apiClient.get).mockResolvedValue(mockTeam);

      const result = await getMyTeam();

      expect(apiClient.get).toHaveBeenCalledWith('/me/team', 'get your team');
      expect(result).toEqual(mockTeam);
    });

    it('returns null when user has no team (404 response)', async () => {
      const notFoundError: ApiError = Object.assign(new Error('Not found'), {
        status: 404,
      });

      vi.mocked(apiClient.get).mockRejectedValue(notFoundError);

      const result = await getMyTeam();

      expect(result).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const serverError: ApiError = Object.assign(new Error('Server error'), {
        status: 500,
      });

      vi.mocked(apiClient.get).mockRejectedValue(serverError);

      await expect(getMyTeam()).rejects.toMatchObject({
        message: 'Server error',
        status: 500,
      });
    });
  });

  describe('getTeams', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      const mockTeams: Team[] = [
        createMockTeam({ id: 1, name: 'Team Alpha', ownerName: 'Alice' }),
        createMockTeam({ id: 2, name: 'Team Beta', ownerName: 'Bob' }),
        createMockTeam({ id: 3, name: 'Team Gamma', ownerName: 'Charlie' }),
      ];

      vi.mocked(apiClient.get).mockResolvedValue(mockTeams);

      const result = await getTeams();

      expect(apiClient.get).toHaveBeenCalledWith('/teams', 'get teams');
      expect(result).toEqual(mockTeams);
    });

    it('returns empty array when no teams exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const result = await getTeams();

      expect(result).toEqual([]);
      expect(apiClient.get).toHaveBeenCalledWith('/teams', 'get teams');
    });

    it('propagates API errors during team retrieval', async () => {
      const mockError = new Error('Failed to fetch teams');

      vi.mocked(apiClient.get).mockRejectedValue(mockError);

      await expect(getTeams()).rejects.toThrow('Failed to fetch teams');
      expect(apiClient.get).toHaveBeenCalledWith('/teams', 'get teams');
    });
  });

  describe('getTeamById', () => {
    it('calls apiClient.get with correct endpoint and team id', async () => {
      const mockTeam: Team = createMockTeam({
        id: 99,
        name: 'Specific Team',
        ownerName: 'David',
      });

      vi.mocked(apiClient.get).mockResolvedValue(mockTeam);

      const result = await getTeamById(99);

      expect(apiClient.get).toHaveBeenCalledWith('/teams/99', 'get team');
      expect(result).toEqual(mockTeam);
    });
  });

  describe('addDriverToTeam', () => {
    it('calls apiClient.post with correct endpoint and request data', async () => {
      const driverId = 5;
      const slotPosition = 2;

      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await addDriverToTeam(driverId, slotPosition);

      const expectedRequest: AddDriverToTeamRequest = {
        DriverId: driverId,
        SlotPosition: slotPosition,
      };

      expect(apiClient.post).toHaveBeenCalledWith(
        '/me/team/drivers',
        expectedRequest,
        'add driver to team',
      );
    });

    it('propagates API errors when adding driver fails', async () => {
      const driverId = 10;
      const slotPosition = 1;
      const mockError = new Error('Failed to add driver');

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(addDriverToTeam(driverId, slotPosition)).rejects.toThrow('Failed to add driver');
    });
  });

  describe('removeDriverFromTeam', () => {
    it('calls apiClient.delete with correct endpoint', async () => {
      const slotPosition = 2;

      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await removeDriverFromTeam(slotPosition);

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/me/team/drivers/2',
        'remove driver from team',
      );
    });

    it('propagates API errors when removing driver fails', async () => {
      const slotPosition = 1;
      const mockError = new Error('Failed to remove driver');

      vi.mocked(apiClient.delete).mockRejectedValue(mockError);

      await expect(removeDriverFromTeam(slotPosition)).rejects.toThrow('Failed to remove driver');
    });
  });

  describe('addConstructorToTeam', () => {
    it('calls apiClient.post with correct endpoint and request data', async () => {
      const constructorId = 3;
      const slotPosition = 1;

      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await addConstructorToTeam(constructorId, slotPosition);

      const expectedRequest: AddConstructorToTeamRequest = {
        ConstructorId: constructorId,
        SlotPosition: slotPosition,
      };

      expect(apiClient.post).toHaveBeenCalledWith(
        '/me/team/constructors',
        expectedRequest,
        'add constructor to team',
      );
    });

    it('propagates API errors when adding constructor fails', async () => {
      const constructorId = 5;
      const slotPosition = 0;
      const mockError = new Error('Failed to add constructor');

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(addConstructorToTeam(constructorId, slotPosition)).rejects.toThrow(
        'Failed to add constructor',
      );
    });
  });

  describe('removeConstructorFromTeam', () => {
    it('calls apiClient.delete with correct endpoint', async () => {
      const slotPosition = 1;

      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await removeConstructorFromTeam(slotPosition);

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/me/team/constructors/1',
        'remove constructor from team',
      );
    });

    it('propagates API errors when removing constructor fails', async () => {
      const slotPosition = 0;
      const mockError = new Error('Failed to remove constructor');

      vi.mocked(apiClient.delete).mockRejectedValue(mockError);

      await expect(removeConstructorFromTeam(slotPosition)).rejects.toThrow(
        'Failed to remove constructor',
      );
    });
  });
});
