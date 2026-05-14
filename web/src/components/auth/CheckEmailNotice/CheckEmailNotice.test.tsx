import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/react';
import { AuthApiError, type AuthError } from '@supabase/supabase-js';
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

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
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
    expect(screen.getByLabelText(/confirmation code/i)).toHaveValue('123456');
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

  describe('Resend', () => {
    it('hides the Resend button when no onResend handler is provided', () => {
      setup();
      expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument();
    });

    it('fires onResend when the button is clicked and announces success', async () => {
      const user = userEvent.setup();
      const onResend = vi.fn().mockResolvedValue(undefined);
      setup({ onResend });

      await user.click(screen.getByRole('button', { name: /resend/i }));

      expect(onResend).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByText('New confirmation email sent.')).toBeInTheDocument();
      });
    });

    it('shows the loading label while the resend request is in flight', async () => {
      const user = userEvent.setup();
      let resolveResend: () => void = () => {};
      const onResend = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveResend = resolve;
          }),
      );
      setup({ onResend });

      await user.click(screen.getByRole('button', { name: /resend/i }));

      const sendingButton = await screen.findByRole('button', { name: /sending/i });
      expect(sendingButton).toHaveAttribute('aria-busy', 'true');

      resolveResend();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /sending/i })).not.toBeInTheDocument();
      });
    });

    it('renders the generic failure message and reports the error to Sentry when onResend rejects without a known code', async () => {
      const user = userEvent.setup();
      const unknownError = new Error('boom');
      const onResend = vi.fn().mockRejectedValue(unknownError);
      setup({ onResend });

      await user.click(screen.getByRole('button', { name: /resend/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Couldn't send the email. Please try again.");
      expect(Sentry.captureException).toHaveBeenCalledWith(unknownError, {
        tags: { component: 'CheckEmailNotice', operation: 'resendConfirmation' },
      });
    });

    it('renders the rate-limit message without reporting to Sentry', async () => {
      const user = userEvent.setup();
      const rateLimitError = new AuthApiError('rate limit', 429, 'over_email_send_rate_limit');
      const onResend = vi.fn().mockRejectedValue(rateLimitError);
      setup({ onResend });

      await user.click(screen.getByRole('button', { name: /resend/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        "You've sent too many confirmation requests. Please try again later.",
      );
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
