import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing required environment variable: VITE_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing required environment variable: VITE_SUPABASE_ANON_KEY');
}

// A recovery token verifies before the new password is set, so the session it
// returns is premature. The default client would persist it and sign the user in
// for a password that never changed.
export const supabaseRecovery = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // Supabase derives an origin-wide lock name from this key and holds it for
    // every auth call, so reusing the default client's would make the two block
    // on each other.
    storageKey: 'sb-recovery-auth-token',
  },
});
