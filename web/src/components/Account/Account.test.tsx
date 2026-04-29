import type { UserProfile } from '@/contracts/UserProfile';
import { createMockUserProfile } from '@/tests/test-utils';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccountForm } from './Account';

function renderForm(
  overrides: { profile?: UserProfile | null; onSubmit?: () => Promise<void> } = {},
) {
  const profile = overrides.profile === undefined ? createMockUserProfile() : overrides.profile;
  const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(undefined);

  const utils = render(<AccountForm profile={profile} onSubmit={onSubmit} />);
  return { ...utils, onSubmit };
}

describe('AccountForm', () => {
  it("displays the user's profile data", () => {
    const profile = createMockUserProfile({
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    renderForm({ profile });

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText(/email/i)).toHaveValue('ada@example.com');
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Lovelace');
  });

  it('displays empty fields when no profile is loaded', () => {
    renderForm({ profile: null });

    expect(screen.getByLabelText(/display name/i)).toHaveValue('');
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
    expect(screen.getByLabelText(/first name/i)).toHaveValue('');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('');
  });

  it('does not save when there are no changes', async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it("saves the user's edits and confirms success", async () => {
    const profile = createMockUserProfile({ displayName: 'Original' });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ profile, onSubmit });
    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'Updated');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      displayName: 'Updated',
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });

    await screen.findAllByText(/profile updated successfully/i);

    // After a successful save, clicking save again with no further edits should not re-save.
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the server error message when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Server exploded'));
    renderForm({ onSubmit });
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'Updated');
    await user.click(screen.getByRole('button', { name: /save/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/server exploded/i);
  });

  it('shows a generic message when saving fails without details', async () => {
    const onSubmit = vi.fn().mockRejectedValue('boom');
    renderForm({ onSubmit });
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'Updated');
    await user.click(screen.getByRole('button', { name: /save/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/failed to update profile/i);
  });

  it('requires a display name', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/display name/i));
    await user.tab();

    expect(await screen.findByText('Display name is required')).toBeInTheDocument();
  });

  it('requires a first name', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/first name/i));
    await user.tab();

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
  });

  it('requires a last name', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/last name/i));
    await user.tab();

    expect(await screen.findByText('Last name is required')).toBeInTheDocument();
  });

  it('caps display name at 50 characters', async () => {
    renderForm();
    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'a'.repeat(51));
    await user.tab();

    expect(
      await screen.findByText('Display name must be less than 50 characters'),
    ).toBeInTheDocument();
  });

  it('rejects malformed email addresses', async () => {
    renderForm();
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email/i);
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.tab();

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it('reflects external updates to the loaded profile', () => {
    const profileA = createMockUserProfile({ displayName: 'Alice' });
    const { rerender } = render(
      <AccountForm profile={profileA} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Alice');

    const profileB = createMockUserProfile({ displayName: 'Bob' });
    rerender(<AccountForm profile={profileB} onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Bob');
  });

  it('clears the previous error after the next save succeeds', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValue(undefined);
    renderForm({ onSubmit });
    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'Updated');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/first error/i);

    // Edit again and save.
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'Updated Again');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
