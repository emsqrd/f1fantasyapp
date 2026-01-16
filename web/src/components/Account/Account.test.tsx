import type { AuthContextType } from '@/contexts/AuthContext';
import { AuthContext } from '@/contexts/AuthContext';
import type { UserProfile } from '@/contracts/UserProfile';
import { avatarEvents } from '@/lib/avatarEvents';
import { userProfileService } from '@/services/userProfileService';
import type { User } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Account } from './Account';

// Use vi.hoisted to ensure mockLoaderData is available before vi.mock hoists
const { mockLoaderData } = vi.hoisted(() => ({
  mockLoaderData: vi.fn(),
}));

// Mock TanStack Router's getRouteApi to provide loader data
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({
    useLoaderData: mockLoaderData,
  }),
}));

// Mock the services and dependencies
vi.mock('@/services/userProfileService');
vi.mock('@/lib/avatarEvents');
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));
vi.mock('../AvatarUpload/AvatarUpload', () => ({
  AvatarUpload: ({
    onAvatarChange,
    onError,
    currentAvatarUrl,
  }: {
    onAvatarChange: (url: string) => void;
    onError: (error: string) => void;
    currentAvatarUrl: string;
  }) => (
    <div>
      <button
        onClick={() => onAvatarChange('new-avatar-url.jpg')}
        data-testid="avatar-upload-success"
      >
        Upload Avatar Success
      </button>
      <button onClick={() => onError('Avatar upload failed')} data-testid="avatar-upload-error">
        Upload Avatar Error
      </button>
      <span data-testid="current-avatar-url">{currentAvatarUrl}</span>
    </div>
  ),
}));

const mockToast = vi.mocked(toast);

const mockUserProfileService = vi.mocked(userProfileService);
const mockAvatarEvents = vi.mocked(avatarEvents);

const mockUserProfile: UserProfile = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'Johnny',
  avatarUrl: 'avatar.jpg',
};

const mockAuthContext: AuthContextType = {
  user: { id: 'user-123' } as User,
  session: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

function renderWithAuth(component: ReactNode, authContext = mockAuthContext) {
  return render(<AuthContext.Provider value={authContext}>{component}</AuthContext.Provider>);
}

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default loader data mock - simulates data fetched by route loader
    mockLoaderData.mockReturnValue({ userProfile: mockUserProfile });
    mockUserProfileService.updateUserProfile.mockResolvedValue(mockUserProfile);
    mockAvatarEvents.emit = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Data Loading', () => {
    it('renders with profile data from loader', () => {
      renderWithAuth(<Account />);

      // Component should render immediately with loader data (no loading state)
      expect(screen.getByLabelText(/display name/i)).toHaveValue(mockUserProfile.displayName);
      expect(screen.getByLabelText(/email/i)).toHaveValue(mockUserProfile.email);
      expect(screen.getByLabelText(/first name/i)).toHaveValue(mockUserProfile.firstName);
      expect(screen.getByLabelText(/last name/i)).toHaveValue(mockUserProfile.lastName);
    });

    it('updates component when loader data changes (user switches accounts)', () => {
      // Start with User A's data
      const userAProfile: UserProfile = {
        id: 'user-a',
        email: 'usera@example.com',
        firstName: 'Alice',
        lastName: 'Anderson',
        displayName: 'Alice A',
        avatarUrl: 'alice.jpg',
      };
      mockLoaderData.mockReturnValue({ userProfile: userAProfile });

      const { rerender } = renderWithAuth(<Account />);

      // Verify User A's data is displayed
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Alice A');
      expect(screen.getByLabelText(/email/i)).toHaveValue('usera@example.com');
      expect(screen.getByLabelText(/first name/i)).toHaveValue('Alice');
      expect(screen.getByLabelText(/last name/i)).toHaveValue('Anderson');

      // Simulate router.invalidate() refetching with User B's data
      const userBProfile: UserProfile = {
        id: 'user-b',
        email: 'userb@example.com',
        firstName: 'Bob',
        lastName: 'Brown',
        displayName: 'Bobby B',
        avatarUrl: 'bob.jpg',
      };
      mockLoaderData.mockReturnValue({ userProfile: userBProfile });

      // Rerender with new loader data (simulates React updating after loader refetch)
      rerender(
        <AuthContext.Provider value={mockAuthContext}>
          <Account />
        </AuthContext.Provider>,
      );

      // Verify User B's data is now displayed (not User A's)
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Bobby B');
      expect(screen.getByLabelText(/email/i)).toHaveValue('userb@example.com');
      expect(screen.getByLabelText(/first name/i)).toHaveValue('Bob');
      expect(screen.getByLabelText(/last name/i)).toHaveValue('Brown');
    });

    it('handles null profile from loader gracefully', () => {
      // Simulate loader returning null profile (e.g., new user)
      mockLoaderData.mockReturnValue({ userProfile: null });

      renderWithAuth(<Account />);

      // Form should render with empty defaults
      expect(screen.getByPlaceholderText('Enter your display name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter your email address')).toHaveValue('');
    });
  });

  describe('Form Population', () => {
    it('handles empty profile fields gracefully', () => {
      const emptyProfile = {
        ...mockUserProfile,
        firstName: '',
        lastName: '',
        displayName: '',
        email: '',
      };
      // Set loader data to return empty profile
      mockLoaderData.mockReturnValue({ userProfile: emptyProfile });

      renderWithAuth(<Account />);

      // Data is pre-loaded, form should show empty values
      expect(screen.getByPlaceholderText('Enter your display name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter your first name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter your last name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter your email address')).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    // Note: Profile fetch errors are now handled by the route's errorComponent
    // Component-level tests focus on update/submission errors

    it('displays error message when profile update fails', async () => {
      mockUserProfileService.updateUserProfile.mockRejectedValue(new Error('Update failed'));

      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded, no waiting needed
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent(/update failed/i);
    });

    it('shows fallback error message when avatar update throws non-Error', async () => {
      // Mock updateUserProfile to reject with a string (not an Error instance)
      mockUserProfileService.updateUserProfile.mockRejectedValue('some string error');

      renderWithAuth(<Account />);

      // Data is pre-loaded, component renders immediately
      const avatarUploadButton = screen.getByTestId('avatar-upload-success');
      await userEvent.click(avatarUploadButton);

      await waitFor(() => {
        // Error shown via toast
        expect(mockToast.error).toHaveBeenCalledWith('Failed to update avatar');
      });
    });

    it('shows fallback error message when saving account throws non-error', async () => {
      // Mock updateUserProfile to reject with a string (not an Error instance)
      mockUserProfileService.updateUserProfile.mockRejectedValue('some string error');

      renderWithAuth(<Account />);

      const user = userEvent.setup();

      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent(/failed to update profile/i);
    });
  });

  describe('Form Validation', () => {
    it('shows validation error for empty required fields', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByText('Display name is required')).toBeInTheDocument();
      });
    });

    it('shows validation error for invalid email format', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });

    it('keeps save button enabled when form is pristine (ARIA best practice)', () => {
      renderWithAuth(<Account />);

      // Data is pre-loaded, no waiting needed
      // LoadingButton doesn't use disabled attribute - keeps button keyboard accessible
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveAttribute('aria-busy', 'false');
    });

    it('silently ignores save button click with no changes', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should not call the service
      expect(mockUserProfileService.updateUserProfile).not.toHaveBeenCalled();

      // Should not show any success or error messages
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('enables save button when form is dirty and valid', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeEnabled();
    });
  });

  describe('Form Submission', () => {
    it('successfully updates user profile', async () => {
      const updatedProfile = { ...mockUserProfile, displayName: 'Updated Name' };
      mockUserProfileService.updateUserProfile.mockResolvedValue(updatedProfile);

      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith({
          ...mockUserProfile,
          displayName: 'Updated Name',
          firstName: mockUserProfile.firstName,
          lastName: mockUserProfile.lastName,
          email: mockUserProfile.email,
        });
      });

      // Check for InlineSuccess message (visible one, not sr-only)
      await waitFor(() => {
        const successMessages = screen.getAllByText(/profile updated successfully/i);
        const visibleSuccess = successMessages.find((el) => !el.classList.contains('sr-only'));
        expect(visibleSuccess).toBeInTheDocument();
      });
    });

    it('resets form to clean state after successful update', async () => {
      const updatedProfile = { ...mockUserProfile, displayName: 'Updated Name' };
      mockUserProfileService.updateUserProfile.mockResolvedValue(updatedProfile);

      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for success feedback (multiple elements exist - sr-only and visible)
      await waitFor(() => {
        expect(screen.getAllByText(/profile updated successfully/i).length).toBeGreaterThan(0);
      });

      // Verify form is reset to clean state - clicking save again should not submit
      await user.click(saveButton);

      // Service should only have been called once (first submit), not twice
      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledTimes(1);
    });

    it('clears previous feedback before new submission', async () => {
      // First, create an error state
      mockUserProfileService.updateUserProfile.mockRejectedValueOnce(new Error('First error'));

      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent(/first error/i);

      // Now mock success and try again
      mockUserProfileService.updateUserProfile.mockResolvedValue({
        ...mockUserProfile,
        displayName: 'Updated Name',
      });

      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledTimes(2);
      });

      // Check for InlineSuccess message (visible one, not sr-only)
      const successMessages = screen.getAllByText(/profile updated successfully/i);
      const visibleSuccess = successMessages.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSuccess).toBeInTheDocument();
    });
  });

  describe('Avatar Upload Integration', () => {
    it('handles successful avatar upload', async () => {
      const updatedProfile = { ...mockUserProfile, avatarUrl: 'new-avatar-url.jpg' };
      mockUserProfileService.updateUserProfile.mockResolvedValue(updatedProfile);

      renderWithAuth(<Account />);

      // Data is pre-loaded by route loader
      const avatarUploadButton = screen.getByTestId('avatar-upload-success');
      await userEvent.click(avatarUploadButton);

      await waitFor(() => {
        // Silent success - avatar URL update is confirmation
        expect(mockUserProfileService.updateUserProfile).toHaveBeenCalled();
      });

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith({
        ...mockUserProfile,
        avatarUrl: 'new-avatar-url.jpg',
      });

      expect(mockAvatarEvents.emit).toHaveBeenCalledWith('new-avatar-url.jpg');
    });

    it('handles avatar upload error', async () => {
      renderWithAuth(<Account />);

      // Data is pre-loaded by route loader
      const avatarErrorButton = screen.getByTestId('avatar-upload-error');
      await userEvent.click(avatarErrorButton);

      await waitFor(() => {
        // Error shown via toast, not inline alert
        expect(mockToast.error).toHaveBeenCalledWith('Avatar upload failed');
      });
    });

    it('handles avatar update service error', async () => {
      mockUserProfileService.updateUserProfile.mockRejectedValue(new Error('Avatar service error'));

      renderWithAuth(<Account />);

      // Data is pre-loaded by route loader
      const avatarUploadButton = screen.getByTestId('avatar-upload-success');
      await userEvent.click(avatarUploadButton);

      await waitFor(() => {
        // Error shown via toast, not inline alert
        expect(mockToast.error).toHaveBeenCalledWith('Avatar service error');
      });
    });

    it('passes current avatar URL to AvatarUpload component', () => {
      renderWithAuth(<Account />);

      // Data is pre-loaded by route loader
      expect(screen.getByTestId('current-avatar-url')).toHaveTextContent(mockUserProfile.avatarUrl);
    });
  });

  describe('Accessibility', () => {
    it('provides proper form labels and structure', () => {
      renderWithAuth(<Account />);

      // Data is pre-loaded by route loader
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });

    it('renders empty form when profile is null', () => {
      // Mock loader to return null profile (simulating no profile found)
      mockLoaderData.mockReturnValue({ userProfile: null });

      renderWithAuth(<Account />);

      // Form should render with empty values when no profile
      expect(screen.getByPlaceholderText('Enter your display name')).toHaveValue('');
    });

    it('displays success feedback via InlineSuccess status', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUserProfileService.updateUserProfile).toHaveBeenCalled();
      });

      // Check for InlineSuccess message (visible one, not sr-only)
      const successMessages = screen.getAllByText(/profile updated successfully/i);
      const visibleSuccess = successMessages.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSuccess).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing user ID in auth context', () => {
      renderWithAuth(<Account />, { ...mockAuthContext, user: {} as User });

      // Data is pre-loaded by route loader
      expect(screen.getByLabelText(/display name/i)).toHaveValue(mockUserProfile.displayName);

      // Should still pass current avatar URL to AvatarUpload
      expect(screen.getByTestId('current-avatar-url')).toHaveTextContent(mockUserProfile.avatarUrl);
    });

    it('handles form submission when user profile state is stale', async () => {
      // Simulate a scenario where profile loader returned stale data
      const staleProfile = { ...mockUserProfile, displayName: 'Stale Name' };
      mockLoaderData.mockReturnValue({ userProfile: staleProfile });

      const updatedProfile = { ...mockUserProfile, displayName: 'Fresh Name' };
      mockUserProfileService.updateUserProfile.mockResolvedValue(updatedProfile);

      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader with stale profile
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Stale Name');

      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Fresh Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Form should be reset after successful update (silent success pattern)
        expect(mockUserProfileService.updateUserProfile).toHaveBeenCalled();
      });

      // Should call update with the stale profile as base
      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith({
        ...staleProfile,
        displayName: 'Fresh Name',
        firstName: staleProfile.firstName,
        lastName: staleProfile.lastName,
        email: staleProfile.email,
      });
    });

    it('handles form validation when transitioning from valid to invalid state', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const emailInput = screen.getByLabelText(/email/i);

      // First make it dirty but valid
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@email.com');

      let saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeEnabled();

      // Then make it invalid
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });

      // Button should still be enabled (React Hook Form allows submission even with validation errors)
      saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeEnabled();
    });

    it('handles rapid successive form submissions', async () => {
      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Data is pre-loaded by route loader
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });

      // Click multiple times rapidly
      await user.click(saveButton);
      await user.click(saveButton);
      await user.click(saveButton);

      await waitFor(() => {
        // Should complete update
        expect(mockUserProfileService.updateUserProfile).toHaveBeenCalled();
      });

      // First click saves and resets form (making it pristine)
      // Subsequent clicks show "No changes to save" without calling service
      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledTimes(1);
    });

    it('handles form editing when profile is null', async () => {
      // Mock loader to return null profile (simulating error case)
      mockLoaderData.mockReturnValue({ userProfile: null });

      renderWithAuth(<Account />);
      const user = userEvent.setup();

      // Form should still be editable even when no profile loaded
      const displayNameInput = screen.getByPlaceholderText('Enter your display name');
      await user.type(displayNameInput, 'Test Name');

      expect(displayNameInput).toHaveValue('Test Name');
    });
  });
});
