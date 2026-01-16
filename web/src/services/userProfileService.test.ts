import type { CreateProfileData } from '@/contracts/CreateProfileData';
import type { UserProfile } from '@/contracts/UserProfile';
// Import the mocked apiClient
import { apiClient } from '@/lib/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userProfileService } from './userProfileService';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('userProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    const mockCreateProfileData: CreateProfileData = {
      displayName: 'John Doe',
    };

    const mockUserProfile: UserProfile = {
      id: 'user-123',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    };

    it('should successfully register a user with display name', async () => {
      mockApiClient.post.mockResolvedValue(mockUserProfile);

      const result = await userProfileService.registerUser(mockCreateProfileData);

      expect(result).toEqual(mockUserProfile);
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/me/register',
        mockCreateProfileData,
        'register user',
      );
    });

    it('should successfully register a user without display name', async () => {
      const emptyProfileData: CreateProfileData = {};
      const expectedProfile: UserProfile = {
        ...mockUserProfile,
        displayName: '',
      };

      mockApiClient.post.mockResolvedValue(expectedProfile);

      const result = await userProfileService.registerUser(emptyProfileData);

      expect(result).toEqual(expectedProfile);
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/me/register',
        emptyProfileData,
        'register user',
      );
    });

    it('should handle registration with special characters in display name', async () => {
      const specialProfileData: CreateProfileData = {
        displayName: "José María O'Connor-Smith",
      };
      const expectedProfile: UserProfile = {
        ...mockUserProfile,
        displayName: "José María O'Connor-Smith",
      };

      mockApiClient.post.mockResolvedValue(expectedProfile);

      const result = await userProfileService.registerUser(specialProfileData);

      expect(result).toEqual(expectedProfile);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/me/register',
        specialProfileData,
        'register user',
      );
    });

    it('should return profile with all required fields after registration', async () => {
      mockApiClient.post.mockResolvedValue(mockUserProfile);

      const result = await userProfileService.registerUser(mockCreateProfileData);

      expect(result).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        displayName: expect.any(String),
        avatarUrl: expect.any(String),
      });
    });

    it('should throw error when registration fails', async () => {
      const errorMessage = 'Registration failed due to validation error';
      mockApiClient.post.mockRejectedValue(new Error(errorMessage));

      await expect(userProfileService.registerUser(mockCreateProfileData)).rejects.toThrow(
        errorMessage,
      );
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error when user already exists', async () => {
      const conflictError = new Error('User with this email already exists');
      mockApiClient.post.mockRejectedValue(conflictError);

      await expect(userProfileService.registerUser(mockCreateProfileData)).rejects.toThrow(
        'User with this email already exists',
      );
    });

    it('should throw error when network fails during registration', async () => {
      const networkError = new Error('Network error: Failed to connect');
      mockApiClient.post.mockRejectedValue(networkError);

      await expect(userProfileService.registerUser(mockCreateProfileData)).rejects.toThrow(
        'Network error: Failed to connect',
      );
    });
  });

  describe('getCurrentProfile', () => {
    const mockUserProfile: UserProfile = {
      id: 'user-456',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      displayName: 'Jane Smith',
      avatarUrl: 'https://example.com/jane-avatar.jpg',
    };

    it('should successfully retrieve current user profile', async () => {
      mockApiClient.get.mockResolvedValue(mockUserProfile);

      const result = await userProfileService.getCurrentProfile();

      expect(result).toEqual(mockUserProfile);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      expect(mockApiClient.get).toHaveBeenCalledWith('/me/profile', 'get your profile');
    });

    it('should return profile with all required fields', async () => {
      mockApiClient.get.mockResolvedValue(mockUserProfile);

      const result = await userProfileService.getCurrentProfile();

      expect(result).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        displayName: expect.any(String),
        avatarUrl: expect.any(String),
      });
    });

    it('should handle profile with empty avatar URL', async () => {
      const profileWithoutAvatar: UserProfile = {
        ...mockUserProfile,
        avatarUrl: '',
      };
      mockApiClient.get.mockResolvedValue(profileWithoutAvatar);

      const result = await userProfileService.getCurrentProfile();

      expect(result).toEqual(profileWithoutAvatar);
      expect(result?.avatarUrl).toBe('');
    });

    it('should throw error when user is not authenticated', async () => {
      const authError = new Error('API Error: Unauthorized');
      mockApiClient.get.mockRejectedValue(authError);

      await expect(userProfileService.getCurrentProfile()).rejects.toThrow(
        'API Error: Unauthorized',
      );
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error when profile not found', async () => {
      const notFoundError = new Error('API Error: Not Found');
      mockApiClient.get.mockRejectedValue(notFoundError);

      await expect(userProfileService.getCurrentProfile()).rejects.toThrow('API Error: Not Found');
    });

    it('should throw error when network fails during profile retrieval', async () => {
      const networkError = new Error('Network error: Connection timeout');
      mockApiClient.get.mockRejectedValue(networkError);

      await expect(userProfileService.getCurrentProfile()).rejects.toThrow(
        'Network error: Connection timeout',
      );
    });
  });

  describe('updateUserProfile', () => {
    const originalProfile: UserProfile = {
      id: 'user-789',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Johnson',
      displayName: 'Bob Johnson',
      avatarUrl: 'https://example.com/bob-old-avatar.jpg',
    };

    it('should successfully update user profile with all fields', async () => {
      const updatedProfile: UserProfile = {
        ...originalProfile,
        firstName: 'Robert',
        displayName: 'Robert Johnson',
        avatarUrl: 'https://example.com/bob-new-avatar.jpg',
      };

      mockApiClient.patch.mockResolvedValue(updatedProfile);

      const result = await userProfileService.updateUserProfile(updatedProfile);

      expect(result).toEqual(updatedProfile);
      expect(mockApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/me/profile',
        updatedProfile,
        'update your profile',
      );
    });

    it('should successfully update only display name', async () => {
      const partialUpdate: Partial<UserProfile> = {
        displayName: 'Bobby J',
      };
      const expectedResponse: UserProfile = {
        ...originalProfile,
        displayName: 'Bobby J',
      };

      mockApiClient.patch.mockResolvedValue(expectedResponse);

      const result = await userProfileService.updateUserProfile(partialUpdate as UserProfile);

      expect(result).toEqual(expectedResponse);
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/me/profile',
        partialUpdate,
        'update your profile',
      );
    });

    it('should successfully update avatar URL', async () => {
      const avatarUpdate: Partial<UserProfile> = {
        avatarUrl: 'https://example.com/new-avatar.png',
      };
      const expectedResponse: UserProfile = {
        ...originalProfile,
        avatarUrl: 'https://example.com/new-avatar.png',
      };

      mockApiClient.patch.mockResolvedValue(expectedResponse);

      const result = await userProfileService.updateUserProfile(avatarUpdate as UserProfile);

      expect(result).toEqual(expectedResponse);
      expect(result.avatarUrl).toBe('https://example.com/new-avatar.png');
    });

    it('should successfully clear avatar URL', async () => {
      const clearAvatarUpdate: Partial<UserProfile> = {
        avatarUrl: '',
      };
      const expectedResponse: UserProfile = {
        ...originalProfile,
        avatarUrl: '',
      };

      mockApiClient.patch.mockResolvedValue(expectedResponse);

      const result = await userProfileService.updateUserProfile(clearAvatarUpdate as UserProfile);

      expect(result).toEqual(expectedResponse);
      expect(result.avatarUrl).toBe('');
    });

    it('should handle special characters in profile update', async () => {
      const specialCharUpdate: Partial<UserProfile> = {
        firstName: 'François',
        lastName: 'Müller-Schmidt',
        displayName: 'François Müller-Schmidt ✨',
      };
      const expectedResponse: UserProfile = {
        ...originalProfile,
        ...specialCharUpdate,
      };

      mockApiClient.patch.mockResolvedValue(expectedResponse);

      const result = await userProfileService.updateUserProfile(specialCharUpdate as UserProfile);

      expect(result).toEqual(expectedResponse);
    });

    it('should return updated profile with all required fields', async () => {
      const updateData: UserProfile = {
        ...originalProfile,
        displayName: 'Updated Name',
      };
      mockApiClient.patch.mockResolvedValue(updateData);

      const result = await userProfileService.updateUserProfile(updateData);

      expect(result).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        displayName: expect.any(String),
        avatarUrl: expect.any(String),
      });
    });

    it('should throw error when update fails due to validation', async () => {
      const validationError = new Error('API Error: Display name is too long');
      mockApiClient.patch.mockRejectedValue(validationError);

      await expect(userProfileService.updateUserProfile(originalProfile)).rejects.toThrow(
        'API Error: Display name is too long',
      );
      expect(mockApiClient.patch).toHaveBeenCalledTimes(1);
    });

    it('should throw error when user is not authorized to update', async () => {
      const authError = new Error('API Error: Forbidden');
      mockApiClient.patch.mockRejectedValue(authError);

      await expect(userProfileService.updateUserProfile(originalProfile)).rejects.toThrow(
        'API Error: Forbidden',
      );
    });

    it('should throw error when network fails during update', async () => {
      const networkError = new Error('Network error: Request timeout');
      mockApiClient.patch.mockRejectedValue(networkError);

      await expect(userProfileService.updateUserProfile(originalProfile)).rejects.toThrow(
        'Network error: Request timeout',
      );
    });
  });

  describe('service integration scenarios', () => {
    it('should handle complete user lifecycle: register -> get -> update', async () => {
      // Step 1: Register user
      const registrationData: CreateProfileData = { displayName: 'Test User' };
      const registeredProfile: UserProfile = {
        id: 'user-integration-test',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
        avatarUrl: '',
      };

      mockApiClient.post.mockResolvedValueOnce(registeredProfile);

      const registerResult = await userProfileService.registerUser(registrationData);
      expect(registerResult).toEqual(registeredProfile);

      // Step 2: Get current profile
      mockApiClient.get.mockResolvedValueOnce(registeredProfile);

      const getCurrentResult = await userProfileService.getCurrentProfile();
      expect(getCurrentResult).toEqual(registeredProfile);

      // Step 3: Update profile
      const updatedProfile: UserProfile = {
        ...registeredProfile,
        displayName: 'Updated Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      mockApiClient.patch.mockResolvedValueOnce(updatedProfile);

      const updateResult = await userProfileService.updateUserProfile(updatedProfile);
      expect(updateResult).toEqual(updatedProfile);
      expect(updateResult.displayName).toBe('Updated Test User');
      expect(updateResult.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should maintain data consistency across service calls', async () => {
      const baseProfile: UserProfile = {
        id: 'consistent-user',
        email: 'consistent@example.com',
        firstName: 'Consistent',
        lastName: 'User',
        displayName: 'Consistent User',
        avatarUrl: 'https://example.com/consistent.jpg',
      };

      mockApiClient.get.mockResolvedValue(baseProfile);
      mockApiClient.patch.mockResolvedValue(baseProfile);

      // Multiple calls should return consistent data
      const profile1 = await userProfileService.getCurrentProfile();
      const profile2 = await userProfileService.getCurrentProfile();
      const updateResult = await userProfileService.updateUserProfile(baseProfile);

      expect(profile1).toEqual(profile2);
      expect(updateResult).toEqual(profile1);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle empty string values appropriately', async () => {
      const profileWithEmptyStrings: UserProfile = {
        id: 'empty-test',
        email: 'empty@example.com',
        firstName: '',
        lastName: '',
        displayName: '',
        avatarUrl: '',
      };

      mockApiClient.patch.mockResolvedValue(profileWithEmptyStrings);

      const result = await userProfileService.updateUserProfile(profileWithEmptyStrings);
      expect(result.firstName).toBe('');
      expect(result.lastName).toBe('');
      expect(result.displayName).toBe('');
      expect(result.avatarUrl).toBe('');
    });

    it('should handle very long display names', async () => {
      const longDisplayName = 'A'.repeat(255);
      const profileWithLongName: UserProfile = {
        id: 'long-name-test',
        email: 'long@example.com',
        firstName: 'Long',
        lastName: 'Name',
        displayName: longDisplayName,
        avatarUrl: '',
      };

      mockApiClient.patch.mockResolvedValue(profileWithLongName);

      const result = await userProfileService.updateUserProfile(profileWithLongName);
      expect(result.displayName).toBe(longDisplayName);
      expect(result.displayName.length).toBe(255);
    });

    it('should handle concurrent service calls appropriately', async () => {
      const profile: UserProfile = {
        id: 'concurrent-test',
        email: 'concurrent@example.com',
        firstName: 'Concurrent',
        lastName: 'Test',
        displayName: 'Concurrent Test',
        avatarUrl: '',
      };

      mockApiClient.get.mockResolvedValue(profile);

      // Simulate concurrent calls
      const promises = Array(5)
        .fill(null)
        .map(() => userProfileService.getCurrentProfile());

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result).toEqual(profile);
      });

      expect(mockApiClient.get).toHaveBeenCalledTimes(5);
    });
  });
});
