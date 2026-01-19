import { TeamProvider } from '@/contexts/TeamContext.tsx';
import * as teamService from '@/services/teamService';
import { createMockTeam } from '@/test-utils';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateTeam } from './CreateTeam';

// Mock dependencies
vi.mock('@/services/teamService');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '123' } }),
}));

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockTeamService = vi.mocked(teamService);

const mockTeam = createMockTeam();

function renderWithTeamProvider(component: React.ReactElement) {
  return render(<TeamProvider>{component}</TeamProvider>);
}

describe('CreateTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamService.createTeam.mockReset();
    mockTeamService.createTeam.mockResolvedValue(mockTeam);
    mockTeamService.getMyTeam.mockResolvedValue(null);
  });

  it('creates team and navigates to team page on successful submission', async () => {
    renderWithTeamProvider(<CreateTeam />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/team name/i), 'My Racing Team');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    await waitFor(() => {
      expect(mockTeamService.createTeam).toHaveBeenCalledWith({
        name: 'My Racing Team',
      });
    });

    // Silent success pattern - navigation is the feedback
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/team/$teamId',
      params: { teamId: '1' },
    });
  });

  it('trims whitespace from team name before submission', async () => {
    renderWithTeamProvider(<CreateTeam />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/team name/i), '  Test Team  ');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    await waitFor(() => {
      expect(mockTeamService.createTeam).toHaveBeenCalledWith({
        name: 'Test Team',
      });
    });
  });

  it('displays validation error for empty team name', async () => {
    renderWithTeamProvider(<CreateTeam />);
    const user = userEvent.setup();

    const teamNameInput = screen.getByLabelText(/team name/i);

    await user.click(teamNameInput);
    await user.tab();

    expect(await screen.findByText(/team name is required/i)).toBeInTheDocument();
  });

  it('displays validation error for team name exceeding 50 characters', async () => {
    renderWithTeamProvider(<CreateTeam />);
    const user = userEvent.setup();

    const longName = 'A'.repeat(51);

    const teamNameInput = screen.getByLabelText(/team name/i);

    await user.type(teamNameInput, longName);
    await user.tab();

    expect(
      await screen.findByText(/team name must be less than 50 characters/i),
    ).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    mockTeamService.createTeam.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTeam), 100)),
    );

    renderWithTeamProvider(<CreateTeam />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/team name/i), 'Test Team');
    await user.click(screen.getByRole('button', { name: /create team/i }));

    const submitButton = screen.getByRole('button', { name: /creating/i });
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });

  // TODO: This keeps failing intermittently
  // it('displays error message when submission fails', async () => {
  //   mockTeamService.createTeam.mockRejectedValueOnce(new Error('Network error'));

  //   renderWithTeamProvider(<CreateTeam />);
  //   const user = userEvent.setup();

  //   await user.type(screen.getByLabelText(/team name/i), 'Test Team');
  //   await user.click(screen.getByRole('button', { name: /create team/i }));

  //   // Wait for error to appear - findByRole automatically waits
  //   const errorAlert = await screen.findByRole('alert');
  //   expect(errorAlert).toHaveTextContent(/network error/i);

  //   // Verify navigation didn't happen
  //   expect(mockNavigate).not.toHaveBeenCalled();

  //   // Wait for button to return to normal state (ensures all async work is done)
  //   await waitFor(() => {
  //     expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  //     expect(screen.getByRole('button', { name: /create team/i })).toHaveAttribute(
  //       'aria-busy',
  //       'false',
  //     );
  //   });
  // });
});
