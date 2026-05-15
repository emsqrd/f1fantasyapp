import { supabase } from '@/lib/supabase';
import { isAuthImplicitGrantRedirectError } from '@supabase/supabase-js';

export type ConfirmationLinkErrorCode = 'expired' | 'generic';

// Returns a code if the user arrived from a failed Supabase confirmation
// link (expired / already-used / invalid token), or null otherwise.
export async function readConfirmationLinkError(): Promise<ConfirmationLinkErrorCode | null> {
  const { error } = await supabase.auth.initialize();
  if (!error || !isAuthImplicitGrantRedirectError(error)) return null;
  return error.details?.code === 'otp_expired' ? 'expired' : 'generic';
}
