import type { CreateProfileData } from '@/contracts/CreateProfileData';
import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthTransitioning: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    additionalData: CreateProfileData,
    options?: { redirect?: string },
  ) => Promise<{ session: Session | null }>;
  signOut: () => Promise<void>;
  startAuthTransition: () => void;
  completeAuthTransition: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
