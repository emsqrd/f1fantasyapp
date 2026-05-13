import { supabase } from '@/lib/supabase';
import type { AuthError } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckEmailNotice } from './CheckEmailNotice';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
    },
  },
}));

describe('CheckEmailNotice', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.verifyOtp).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setup = (overrides: Partial<React.ComponentProps<typeof CheckEmailNotice>> = {}) => {
    const props: React.ComponentProps<typeof CheckEmailNotice> = {
      email: 'user@example.com',
      onVerified: vi.fn(),
      ...overrides,
    };
    render(<CheckEmailNotice {...props} />);
    return props;
  };

  it('renders the email prop in the body', () => {
    setup({ email: 'driver@example.com' });
    expect(screen.getByText('driver@example.com')).toBeInTheDocument();
  });

  it('auto-submits and calls verifyOtp with the email + code when the 6th digit lands', async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    const props = setup();

    await user.type(screen.getByLabelText(/confirmation code/i), '123456');

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        token: '123456',
        type: 'signup',
      });
    });
    await waitFor(() => {
      expect(props.onVerified).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the failure UI and skips onVerified when verification fails', async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Invalid code') as AuthError,
    });
    const props = setup();

    await user.type(screen.getByLabelText(/confirmation code/i), '123456');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/that code didn't match/i);
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it('keeps the Verify button disabled and verifyOtp uncalled until 6 digits land', async () => {
    const user = userEvent.setup();
    setup();

    const button = screen.getByRole('button', { name: /verify/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/confirmation code/i), '12345');
    expect(button).toBeDisabled();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
