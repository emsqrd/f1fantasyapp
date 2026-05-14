import { supabase } from '@/lib/supabase';

export async function resendConfirmation(
  email: string,
  options?: { emailRedirectTo?: string },
): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: options?.emailRedirectTo },
  });
  if (error) throw error;
}
