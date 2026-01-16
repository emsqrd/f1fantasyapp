import type { League } from '@/contracts/League';
import * as leagueService from '@/services/leagueService';
import { createMockLeague } from '@/test-utils/mockFactories';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateLeague } from './CreateLeague';

vi.mock('@/services/leagueService');

const mockLeagueService = vi.mocked(leagueService);

const mockLeague: League = createMockLeague();

describe('CreateLeague', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeagueService.createLeague.mockResolvedValue(mockLeague);
  });

  describe('Dialog Behavior', () => {
    it('should reset form when dialog is closed', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      // Open dialog and fill form
      await user.click(screen.getByRole('button', { name: /create league/i }));
      await user.type(screen.getByLabelText(/league name/i), 'Test League');

      // Close dialog
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      await user.click(closeButtons[0]); // Click the first close button

      // Reopen dialog
      await user.click(screen.getByRole('button', { name: /create league/i }));

      // Form should be empty
      expect(screen.getByLabelText(/league name/i)).toHaveValue('');
    });

    it('should clear validation errors after successful submission and reopening', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      // Trigger validation error
      const leagueNameInput = screen.getByLabelText(/league name/i);
      await user.click(leagueNameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/league name is required/i)).toBeInTheDocument();
      });

      // Fix error and submit
      await user.type(leagueNameInput, 'Valid League');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Reopen dialog
      await user.click(screen.getByRole('button', { name: /create league/i }));

      // Error should not persist
      expect(screen.queryByText(/league name is required/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should display validation errors when form is invalid', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      const leagueNameInput = screen.getByLabelText(/league name/i);
      await user.click(leagueNameInput);
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByText(/league name is required/i)).toBeInTheDocument();
      });
    });

    it('should enable submit button when form is valid and dirty', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Valid League Name');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });
    });

    it('should trim whitespace from league name', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), '  Test League  ');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockLeagueService.createLeague).toHaveBeenCalledWith({
          name: 'Test League',
          description: '',
          isPrivate: true,
        });
      });
    });

    it('should trim whitespace from description', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');
      await user.type(screen.getByLabelText(/description/i), '  Test Description  ');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockLeagueService.createLeague).toHaveBeenCalledWith({
          name: 'Test League',
          description: 'Test Description',
          isPrivate: true,
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('should successfully create league with all fields', async () => {
      const onLeagueCreated = vi.fn();
      render(<CreateLeague onLeagueCreated={onLeagueCreated} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');
      await user.type(screen.getByLabelText(/description/i), 'Test Description');
      await user.click(screen.getByRole('switch', { name: /private/i })); // Toggle to public

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockLeagueService.createLeague).toHaveBeenCalledWith({
          name: 'Test League',
          description: 'Test Description',
          isPrivate: false,
        });
      });

      expect(onLeagueCreated).toHaveBeenCalledWith(mockLeague);
    });

    it('should successfully create league with only required fields', async () => {
      const onLeagueCreated = vi.fn();
      render(<CreateLeague onLeagueCreated={onLeagueCreated} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockLeagueService.createLeague).toHaveBeenCalledWith({
          name: 'Test League',
          description: '',
          isPrivate: true,
        });
      });

      expect(onLeagueCreated).toHaveBeenCalledWith(mockLeague);
    });

    it('should reset form after successful submission', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      // First submission
      await user.click(screen.getByRole('button', { name: /create league/i }));
      await user.type(screen.getByLabelText(/league name/i), 'First League');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Open dialog again
      await user.click(screen.getByRole('button', { name: /create league/i }));

      // Form should be reset
      expect(screen.getByLabelText(/league name/i)).toHaveValue('');
      expect(screen.getByLabelText(/description/i)).toHaveValue('');
      expect(screen.getByRole('switch', { name: /private/i })).toBeChecked();
    });

    it('should disable submit button during submission', async () => {
      mockLeagueService.createLeague.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockLeague), 100)),
      );

      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');
      const submitButton = screen.getByRole('button', { name: /submit/i });

      await user.click(submitButton);

      expect(submitButton).toHaveAttribute('aria-busy', 'true');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when submission fails with Error', async () => {
      mockLeagueService.createLeague.mockRejectedValue(new Error('Network error'));

      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent(/network error/i);

      // Dialog should remain open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should allow retry after failed submission', async () => {
      mockLeagueService.createLeague
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(mockLeague);

      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');

      // First attempt - fails
      await user.click(screen.getByRole('button', { name: /submit/i }));

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toHaveTextContent(/first attempt failed/i);

      // Second attempt - succeeds
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(mockLeagueService.createLeague).toHaveBeenCalledTimes(2);
    });
  });

  describe('Private Toggle', () => {
    it('should submit correct isPrivate value based on toggle state', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), 'Test League');

      // Toggle to public
      await user.click(screen.getByRole('switch', { name: /private/i }));

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockLeagueService.createLeague).toHaveBeenCalledWith({
          name: 'Test League',
          description: '',
          isPrivate: false,
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle form submission with special characters', async () => {
      render(<CreateLeague />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create league/i }));

      await user.type(screen.getByLabelText(/league name/i), "Test's League & Co.");
      await user.type(screen.getByLabelText(/description/i), 'League with "quotes" & symbols');

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockLeagueService.createLeague).toHaveBeenCalledWith({
          name: "Test's League & Co.",
          description: 'League with "quotes" & symbols',
          isPrivate: true,
        });
      });
    });
  });
});
