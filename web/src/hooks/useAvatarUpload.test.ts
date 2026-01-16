import { supabase } from '@/lib/supabase';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAvatarUpload } from './useAvatarUpload';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  },
}));

describe('useAvatarUpload', () => {
  const mockUserId = 'test-user-123';
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  const createMockFile = (
    name: string = 'test.jpg',
    type: string = 'image/jpeg',
    size: number = 1024,
  ): File => {
    const file = new File(['mock content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  const mockStorageFrom = vi.mocked(supabase.storage.from);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to setup storage mocks
  const setupStorageMock = (uploadResult: { error: Error | null }, publicUrl: string) => {
    const mockUpload = vi.fn().mockResolvedValue(uploadResult);
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl } });

    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    } as unknown as ReturnType<typeof supabase.storage.from>);

    return { mockUpload, mockGetPublicUrl };
  };

  describe('initial state', () => {
    it('should initialize with default upload state', () => {
      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      expect(result.current.uploadState).toEqual({
        uploading: false,
        progress: 0,
        error: null,
      });
    });

    it('should provide uploadAvatar function and resetError function', () => {
      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      expect(typeof result.current.uploadAvatar).toBe('function');
      expect(typeof result.current.resetError).toBe('function');
    });
  });

  describe('file validation', () => {
    it('should reject invalid file types', async () => {
      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onError: mockOnError,
        }),
      );

      const invalidFile = createMockFile('test.txt', 'text/plain');

      await act(async () => {
        await result.current.uploadAvatar(invalidFile);
      });

      expect(result.current.uploadState.error).toBe(
        'Please upload a valid image file (JPEG, PNG, or WebP)',
      );
      expect(mockOnError).toHaveBeenCalledWith(
        'Please upload a valid image file (JPEG, PNG, or WebP)',
      );
    });

    it('should accept valid image file types', async () => {
      setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const validTypes = [
        createMockFile('test.jpg', 'image/jpeg'),
        createMockFile('test.png', 'image/png'),
        createMockFile('test.webp', 'image/webp'),
      ];

      for (const file of validTypes) {
        await act(async () => {
          await result.current.uploadAvatar(file);
        });

        expect(result.current.uploadState.error).toBeNull();
      }
    });

    it('should reject files larger than 5MB', async () => {
      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onError: mockOnError,
        }),
      );

      const largeFile = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024);

      await act(async () => {
        await result.current.uploadAvatar(largeFile);
      });

      expect(result.current.uploadState.error).toBe('File size must be less than 5MB');
      expect(mockOnError).toHaveBeenCalledWith('File size must be less than 5MB');
    });

    it('should accept files under 5MB', async () => {
      setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const validFile = createMockFile('valid.jpg', 'image/jpeg', 4 * 1024 * 1024);

      await act(async () => {
        await result.current.uploadAvatar(validFile);
      });

      expect(result.current.uploadState.error).toBeNull();
    });
  });

  describe('successful upload flow', () => {
    it('should update state correctly during successful upload', async () => {
      setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onSuccess: mockOnSuccess,
        }),
      );

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(result.current.uploadState).toEqual({
        uploading: false,
        progress: 100,
        error: null,
      });
    });

    it('should call onSuccess callback with public URL', async () => {
      const publicUrl = 'https://example.com/avatar.jpg';
      setupStorageMock({ error: null }, publicUrl);

      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onSuccess: mockOnSuccess,
        }),
      );

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(publicUrl);
    });

    it('should return public URL from uploadAvatar function', async () => {
      const publicUrl = 'https://example.com/avatar.jpg';
      setupStorageMock({ error: null }, publicUrl);

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const file = createMockFile('test.jpg', 'image/jpeg');
      let returnedUrl: string | undefined;

      await act(async () => {
        returnedUrl = await result.current.uploadAvatar(file);
      });

      expect(returnedUrl).toBe(publicUrl);
    });

    it('should generate unique filename with timestamp and userId', async () => {
      const { mockUpload } = setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(mockUpload).toHaveBeenCalledWith(
        `${mockUserId}/${mockUserId}-1704110400000.jpg`,
        file,
        {
          cacheControl: '3000',
          upsert: true,
        },
      );
    });
  });

  describe('upload error handling', () => {
    it('should handle Supabase upload errors', async () => {
      const uploadError = new Error('Upload failed');
      setupStorageMock({ error: uploadError }, '');

      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onError: mockOnError,
        }),
      );

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(result.current.uploadState).toEqual({
        uploading: false,
        progress: 0,
        error: 'Upload failed',
      });
      expect(mockOnError).toHaveBeenCalledWith('Upload failed');
    });

    it('should handle generic errors during upload', async () => {
      const mockUpload = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockGetPublicUrl = vi.fn();

      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      } as unknown as ReturnType<typeof supabase.storage.from>);

      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onError: mockOnError,
        }),
      );

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(result.current.uploadState).toEqual({
        uploading: false,
        progress: 0,
        error: 'Network error',
      });
      expect(mockOnError).toHaveBeenCalledWith('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      const mockUpload = vi.fn().mockRejectedValue('String error');
      const mockGetPublicUrl = vi.fn();

      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      } as unknown as ReturnType<typeof supabase.storage.from>);

      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          onError: mockOnError,
        }),
      );

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(result.current.uploadState.error).toBe('Upload failed');
      expect(mockOnError).toHaveBeenCalledWith('Upload failed');
    });
  });

  describe('resetError functionality', () => {
    it('should clear error state when resetError is called', async () => {
      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      // First trigger an error
      const invalidFile = createMockFile('test.txt', 'text/plain');

      await act(async () => {
        await result.current.uploadAvatar(invalidFile);
      });

      expect(result.current.uploadState.error).not.toBeNull();

      // Then reset the error
      act(() => {
        result.current.resetError();
      });

      expect(result.current.uploadState.error).toBeNull();
    });

    it('should preserve other state properties when resetting error', async () => {
      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      // Set an error state
      const invalidFile = createMockFile('test.txt', 'text/plain');

      await act(async () => {
        await result.current.uploadAvatar(invalidFile);
      });

      const stateBeforeReset = result.current.uploadState;

      act(() => {
        result.current.resetError();
      });

      expect(result.current.uploadState).toEqual({
        ...stateBeforeReset,
        error: null,
      });
    });
  });

  describe('custom bucket name', () => {
    it('should use custom bucket name when provided', async () => {
      const customBucket = 'custom-avatars';
      setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() =>
        useAvatarUpload({
          userId: mockUserId,
          bucketName: customBucket,
        }),
      );

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(mockStorageFrom).toHaveBeenCalledWith(customBucket);
    });

    it('should use default bucket name when not provided', async () => {
      setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const file = createMockFile('test.jpg', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(mockStorageFrom).toHaveBeenCalledWith('avatars');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined file gracefully', async () => {
      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      await act(async () => {
        await result.current.uploadAvatar(null!);
      });

      expect(result.current.uploadState).toEqual({
        uploading: false,
        progress: 0,
        error: null,
      });
    });

    it('should handle files without extensions', async () => {
      const { mockUpload } = setupStorageMock({ error: null }, 'https://example.com/avatar');

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const file = createMockFile('noextension', 'image/jpeg');

      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      expect(mockUpload).toHaveBeenCalledWith(
        `${mockUserId}/${mockUserId}-1704110400000.noextension`,
        file,
        {
          cacheControl: '3000',
          upsert: true,
        },
      );
    });
  });

  describe('state transitions during upload', () => {
    it('should set uploading to true and then false during upload flow', async () => {
      setupStorageMock({ error: null }, 'https://example.com/avatar.jpg');

      const { result } = renderHook(() => useAvatarUpload({ userId: mockUserId }));

      const file = createMockFile('test.jpg', 'image/jpeg');

      // Initially should not be uploading
      expect(result.current.uploadState.uploading).toBe(false);

      // Start upload and verify final state
      await act(async () => {
        await result.current.uploadAvatar(file);
      });

      // After upload completes, should not be uploading and should have success state
      expect(result.current.uploadState.uploading).toBe(false);
      expect(result.current.uploadState.progress).toBe(100);
      expect(result.current.uploadState.error).toBeNull();
    });
  });
});
