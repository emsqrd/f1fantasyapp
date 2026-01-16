import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AvatarUpload } from './AvatarUpload';

// Mock the hook with a clean interface
vi.mock('@/hooks/useAvatarUpload');

const mockUseAvatarUpload = vi.mocked(useAvatarUpload);

describe('AvatarUpload', () => {
  const defaultProps = {
    userId: 'user-123',
    onAvatarChange: vi.fn(),
  };

  const createMockFile = (name = 'avatar.png', type = 'image/png') =>
    new File(['mock-content'], name, { type });

  beforeEach(() => {
    vi.resetAllMocks();

    // Default hook mock - successful state
    mockUseAvatarUpload.mockReturnValue({
      uploadState: { uploading: false, error: null, progress: 0 },
      uploadAvatar: vi.fn(),
      resetError: vi.fn(),
    });

    // Mock Image constructor with full HTMLImageElement interface for Radix UI compatibility
    global.Image = class MockImage extends EventTarget {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        super();
      }

      set src(_: string) {
        // Simulate successful image load by default
        setTimeout(() => {
          this.onload?.();
          this.dispatchEvent(new Event('load'));
        }, 0);
      }
    } as unknown as typeof Image;
  });

  describe('Initial rendering', () => {
    it('should render avatar with fallback icon when no current avatar', () => {
      render(<AvatarUpload {...defaultProps} />);

      // Should show fallback icon (when no src, Avatar shows fallback)
      expect(
        screen.getByText('', { selector: '[data-slot="avatar-fallback"]' }),
      ).toBeInTheDocument();

      // Should show change button
      expect(screen.getByRole('button', { name: /change avatar/i })).toBeInTheDocument();

      // Should have hidden file input
      expect(screen.getByLabelText(/upload avatar image/i)).toBeInTheDocument();
    });

    it('should render with existing avatar image', async () => {
      const avatarUrl = 'https://example.com/avatar.png';
      render(<AvatarUpload {...defaultProps} currentAvatarUrl={avatarUrl} />);

      // Wait for the image to load and appear
      const avatarImg = await screen.findByRole('img', { name: /current avatar/i });
      expect(avatarImg).toHaveAttribute('src', avatarUrl);
    });

    it('should apply custom size classes', () => {
      const { container } = render(<AvatarUpload {...defaultProps} size="sm" />);

      expect(container.querySelector('.h-12.w-12')).toBeInTheDocument();
    });
  });

  describe('File selection and upload', () => {
    it('should open file dialog when change button is clicked', async () => {
      const user = userEvent.setup();
      render(<AvatarUpload {...defaultProps} />);

      const changeButton = screen.getByRole('button', { name: /change avatar/i });
      const fileInput = screen.getByLabelText(/upload avatar image/i) as HTMLInputElement;

      // Mock the click method
      const clickSpy = vi.spyOn(fileInput, 'click');

      await user.click(changeButton);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should call uploadAvatar when file is selected', async () => {
      const mockUploadAvatar = vi.fn();
      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: null, progress: 0 },
        uploadAvatar: mockUploadAvatar,
        resetError: vi.fn(),
      });

      const user = userEvent.setup();
      render(<AvatarUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i);
      const file = createMockFile();

      await user.upload(fileInput, file);

      expect(mockUploadAvatar).toHaveBeenCalledWith(file);
    });

    it('should handle multiple file selection by using only the first file', async () => {
      const mockUploadAvatar = vi.fn();
      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: null, progress: 0 },
        uploadAvatar: mockUploadAvatar,
        resetError: vi.fn(),
      });

      const user = userEvent.setup();
      render(<AvatarUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i);
      const files = [createMockFile('avatar1.png'), createMockFile('avatar2.png')];

      await user.upload(fileInput, files);

      expect(mockUploadAvatar).toHaveBeenCalledWith(files[0]);
    });

    it('should handle user canceling file selection gracefully', async () => {
      const onAvatarChange = vi.fn();
      const onError = vi.fn();

      render(<AvatarUpload {...defaultProps} onAvatarChange={onAvatarChange} onError={onError} />);

      const changeButton = screen.getByRole('button', { name: /change avatar/i });

      // User clicks to change avatar but cancels the file dialog
      await userEvent.click(changeButton);

      // Wait a brief moment to ensure no unexpected side effects
      await waitFor(() => {
        expect(onAvatarChange).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
      });

      // UI should remain in initial state
      expect(screen.getByRole('button', { name: /change avatar/i })).toBeEnabled();
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    it('should handle null file input gracefully (defensive guard)', () => {
      const mockUploadAvatar = vi.fn();
      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: null, progress: 0 },
        uploadAvatar: mockUploadAvatar,
        resetError: vi.fn(),
      });

      render(<AvatarUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i);

      // Test the defensive guard clause - this prevents runtime errors
      // if the file input is somehow cleared or becomes null
      fireEvent.change(fileInput, { target: { files: null } });

      expect(mockUploadAvatar).not.toHaveBeenCalled();
    });
  });

  describe('Upload states', () => {
    it('should show loading state during upload', () => {
      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: true, error: null, progress: 50 },
        uploadAvatar: vi.fn(),
        resetError: vi.fn(),
      });

      render(<AvatarUpload {...defaultProps} />);

      // Button should be disabled
      expect(screen.getByRole('button', { name: /change avatar/i })).toBeDisabled();

      // Loading spinner should be visible
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should display upload errors', () => {
      const errorMessage = 'Upload failed: File too large';
      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: errorMessage, progress: 0 },
        uploadAvatar: vi.fn(),
        resetError: vi.fn(),
      });

      render(<AvatarUpload {...defaultProps} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should call onError when useAvatarUpload hook triggers error callback', async () => {
      const onError = vi.fn();
      const errorMessage = 'Upload service error';

      // Mock uploadAvatar to trigger the hook's onError callback
      const mockUploadAvatar = vi.fn().mockImplementation(() => {
        const hookCall = mockUseAvatarUpload.mock.calls[0][0];
        setTimeout(() => hookCall.onError?.(errorMessage), 0);
      });

      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: null, progress: 0 },
        uploadAvatar: mockUploadAvatar,
        resetError: vi.fn(),
      });

      const user = userEvent.setup();
      render(<AvatarUpload {...defaultProps} onError={onError} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i);
      const file = createMockFile();

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(errorMessage);
      });
    });
  });

  describe('Successful upload flow', () => {
    it('should update avatar and call onAvatarChange on successful upload', async () => {
      const newAvatarUrl = 'https://example.com/new-avatar.png';
      const onAvatarChange = vi.fn();

      // Mock successful upload that triggers onSuccess callback
      const mockUploadAvatar = vi.fn().mockImplementation(() => {
        // Simulate the hook calling onSuccess
        const hookCall = mockUseAvatarUpload.mock.calls[0][0];
        setTimeout(() => hookCall.onSuccess?.(newAvatarUrl), 0);
      });

      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: null, progress: 100 },
        uploadAvatar: mockUploadAvatar,
        resetError: vi.fn(),
      });

      const user = userEvent.setup();
      render(<AvatarUpload {...defaultProps} onAvatarChange={onAvatarChange} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i);
      const file = createMockFile();

      await user.upload(fileInput, file);

      await waitFor(() => {
        const avatarImg = screen.getByRole('img', { name: /current avatar/i });
        expect(avatarImg).toHaveAttribute('src', newAvatarUrl);
      });

      expect(onAvatarChange).toHaveBeenCalledWith(newAvatarUrl);
    });

    it('should handle image preload failure and call onError', async () => {
      const onError = vi.fn();
      const badImageUrl = 'https://example.com/broken-image.png';

      // Mock Image constructor to simulate load failure
      global.Image = class MockImage extends EventTarget {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor() {
          super();
        }

        set src(_: string) {
          // Simulate image load failure
          setTimeout(() => {
            this.onerror?.();
            this.dispatchEvent(new Event('error'));
          }, 0);
        }
      } as unknown as typeof Image;

      const mockUploadAvatar = vi.fn().mockImplementation(() => {
        const hookCall = mockUseAvatarUpload.mock.calls[0][0];
        setTimeout(() => hookCall.onSuccess?.(badImageUrl), 0);
      });

      mockUseAvatarUpload.mockReturnValue({
        uploadState: { uploading: false, error: null, progress: 100 },
        uploadAvatar: mockUploadAvatar,
        resetError: vi.fn(),
      });

      const user = userEvent.setup();
      render(<AvatarUpload {...defaultProps} onError={onError} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i);
      const file = createMockFile();

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Failed to load new avatar image');
      });
    });
  });

  describe('Props and customization', () => {
    it('should sync display URL when currentAvatarUrl prop changes', async () => {
      const initialUrl = 'https://example.com/initial.png';
      const { rerender } = render(<AvatarUpload {...defaultProps} currentAvatarUrl={initialUrl} />);

      let avatarImg = await screen.findByRole('img', { name: /current avatar/i });
      expect(avatarImg).toHaveAttribute('src', initialUrl);

      const newUrl = 'https://example.com/updated.png';
      rerender(<AvatarUpload {...defaultProps} currentAvatarUrl={newUrl} />);

      await waitFor(async () => {
        avatarImg = await screen.findByRole('img', { name: /current avatar/i });
        expect(avatarImg).toHaveAttribute('src', newUrl);
      });
    });

    it('should apply custom className', () => {
      const customClass = 'custom-avatar-class';
      const { container } = render(<AvatarUpload {...defaultProps} className={customClass} />);

      expect(container.firstChild).toHaveClass(customClass);
    });

    it('should show button on hover (CSS behavior test)', () => {
      render(<AvatarUpload {...defaultProps} />);

      const button = screen.getByRole('button', { name: /change avatar/i });

      // Button should have opacity-0 class by default (hidden)
      expect(button).toHaveClass('opacity-0');

      // Button should have group-hover:opacity-100 class (shown on hover)
      expect(button).toHaveClass('group-hover:opacity-100');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AvatarUpload {...defaultProps} />);

      expect(screen.getByLabelText(/upload avatar image/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /change avatar/i })).toBeInTheDocument();
      // Avatar container should be present
      expect(document.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    });

    it('should have correct file input attributes', () => {
      render(<AvatarUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText(/upload avatar image/i) as HTMLInputElement;

      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
      expect(fileInput).toHaveClass('hidden');
    });
  });
});
