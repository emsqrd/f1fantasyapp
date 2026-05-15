import type { AuthError } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resendConfirmation } from './auth-resend';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
    },
  },
}));

describe('resendConfirmation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls supabase.auth.resend with type signup and undefined emailRedirectTo by default', async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    await resendConfirmation('test@example.com');

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: { emailRedirectTo: undefined },
    });
  });

  it('forwards emailRedirectTo to supabase.auth.resend when provided', async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    const customRedirect = 'http://localhost/join/xyz';

    await resendConfirmation('test@example.com', { emailRedirectTo: customRedirect });

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: { emailRedirectTo: customRedirect },
    });
  });

  it('throws when supabase.auth.resend returns an error', async () => {
    const resendError = Object.assign(new Error('rate limit'), {
      code: 'over_email_send_rate_limit',
    }) as AuthError;
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: { user: null, session: null },
      error: resendError,
    });

    await expect(resendConfirmation('test@example.com')).rejects.toBe(resendError);
  });
});
