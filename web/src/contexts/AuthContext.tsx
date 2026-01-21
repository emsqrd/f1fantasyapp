import type { CreateProfileData } from '@/contracts/CreateProfileData';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, additionalData: CreateProfileData) => {
    if (!additionalData.displayName?.trim()) {
      throw new Error('Display name is required');
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName: additionalData.displayName,
        },
      },
    });

    if (error) throw error;
  };

  const signOut = async () => {
    // Create a promise that resolves when auth state is cleared
    const authStateCleared = new Promise<void>((resolve) => {
      const unsubscribe = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || session === null) {
          unsubscribe.data.subscription.unsubscribe();
          resolve();
        }
      });
    });

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Wait for auth state to be cleared before resolving
    await authStateCleared;
  };

  const startAuthTransition = () => {
    setIsAuthTransitioning(true);
  };

  const completeAuthTransition = () => {
    setIsAuthTransitioning(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthTransitioning,
        signIn,
        signUp,
        signOut,
        startAuthTransition,
        completeAuthTransition,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
