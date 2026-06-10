import type { CreateProfileData } from '@/contracts/CreateProfileData';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthSnapshot {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthTransitioning: boolean;
}

export interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    additionalData: CreateProfileData,
    options?: { emailRedirectTo?: string },
  ) => Promise<{ session: Session | null }>;
  signOut: () => Promise<void>;
  startAuthTransition: () => void;
  completeAuthTransition: () => void;
}

export type Auth = AuthSnapshot & AuthActions;

const initialSnapshot: AuthSnapshot = {
  user: null,
  session: null,
  loading: true,
  isAuthTransitioning: false,
};

let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function setSnapshot(patch: Partial<AuthSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const defaultActions: AuthActions = {
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email, password, additionalData, options) => {
    if (!additionalData.displayName?.trim()) {
      throw new Error('Display name is required');
    }

    const emailRedirectTo = options?.emailRedirectTo ?? `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName: additionalData.displayName,
        },
        emailRedirectTo,
      },
    });

    if (error) throw error;
    return { session: data.session };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  startAuthTransition: () => setSnapshot({ isAuthTransitioning: true }),

  completeAuthTransition: () => setSnapshot({ isAuthTransitioning: false }),
};

let actions: AuthActions = defaultActions;

export function getAuthActions(): AuthActions {
  return actions;
}

let teardownInit: (() => void) | null = null;

/**
 * Wires the store to Supabase: seeds from `getSession()` and tracks every
 * subsequent auth event. Called once from `main.tsx`; calling again returns the
 * existing teardown. Supabase awaits its auth listeners inside `signIn`/`signOut`,
 * so the snapshot is already current when those calls resolve — readers never
 * see a stale user after an awaited auth call.
 */
export function initAuthStore(): () => void {
  if (teardownInit) return teardownInit;

  supabase.auth.getSession().then(({ data: { session } }) => {
    setSnapshot({ session, user: session?.user ?? null, loading: false });
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSnapshot({ session, user: session?.user ?? null, loading: false });
  });

  teardownInit = () => {
    subscription.unsubscribe();
    teardownInit = null;
  };
  return teardownInit;
}

/** Test-only: applies the given snapshot state and replaces any provided actions with fakes. */
export function seedAuthStore(overrides: Partial<Auth>): void {
  const { signIn, signUp, signOut, startAuthTransition, completeAuthTransition, ...state } =
    overrides;

  setSnapshot(state);
  actions = {
    ...actions,
    ...(signIn && { signIn }),
    ...(signUp && { signUp }),
    ...(signOut && { signOut }),
    ...(startAuthTransition && { startAuthTransition }),
    ...(completeAuthTransition && { completeAuthTransition }),
  };
}

/** Test-only: tears down `initAuthStore` and restores the initial state and real actions. */
export function resetAuthStore(): void {
  teardownInit?.();
  snapshot = initialSnapshot;
  actions = defaultActions;
  listeners.clear();
}
