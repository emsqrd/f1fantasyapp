import { AuthImplicitGrantRedirectError } from '@supabase/supabase-js';
import type { AuthError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      initialize: vi.fn(),
    },
  },
}));

describe('readConfirmationLinkError', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns "expired" when initialize() returns AuthImplicitGrantRedirectError with otp_expired code', async () => {
    const error = new AuthImplicitGrantRedirectError('Email link is invalid or has expired', {
      error: 'access_denied',
      code: 'otp_expired',
    });
    vi.mocked(supabase.auth.initialize).mockResolvedValue({ error });

    const { readConfirmationLinkError } = await import('./auth-redirect');
    await expect(readConfirmationLinkError()).resolves.toBe('expired');
  });

  it('returns "generic" for AuthImplicitGrantRedirectError with any other code', async () => {
    const error = new AuthImplicitGrantRedirectError('Not a valid PKCE flow url.', {
      error: 'unspecified_error',
      code: 'unspecified_code',
    });
    vi.mocked(supabase.auth.initialize).mockResolvedValue({ error });

    const { readConfirmationLinkError } = await import('./auth-redirect');
    await expect(readConfirmationLinkError()).resolves.toBe('generic');
  });

  it('returns null when initialize() succeeds', async () => {
    vi.mocked(supabase.auth.initialize).mockResolvedValue({ error: null });

    const { readConfirmationLinkError } = await import('./auth-redirect');
    await expect(readConfirmationLinkError()).resolves.toBeNull();
  });

  it('returns null for non-redirect auth errors (e.g. network failures)', async () => {
    const otherError = new Error('network down') as AuthError;
    otherError.name = 'AuthRetryableFetchError';
    vi.mocked(supabase.auth.initialize).mockResolvedValue({ error: otherError });

    const { readConfirmationLinkError } = await import('./auth-redirect');
    await expect(readConfirmationLinkError()).resolves.toBeNull();
  });
});
