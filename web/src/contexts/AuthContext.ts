import type { CreateProfileData } from '@/contracts/CreateProfileData';
import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, additionalData: CreateProfileData) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
