import { supabase } from '@/lib/supabase';
import { supabaseRecovery } from '@/lib/supabaseRecovery';

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function verifyRecoveryToken(tokenHash: string): Promise<void> {
  const { error } = await supabaseRecovery.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  });
  if (error) throw error;
}

export async function completePasswordReset(password: string): Promise<void> {
  const { error } = await supabaseRecovery.auth.updateUser({ password });
  if (error) throw error;

  const {
    data: { session },
  } = await supabaseRecovery.auth.getSession();

  if (session) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }

  // The default sign-out revokes server-side, which would kill the session just
  // handed to `supabase`.
  await supabaseRecovery.auth.signOut({ scope: 'local' });
}
