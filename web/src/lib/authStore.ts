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

export interface RouterAuth {
  user: User | null;
}

/**
 * Live view for the router context: reads go through to the current snapshot,
 * so guards and loaders evaluate auth at execution time, never a copy captured
 * at render time.
 */
export const routerAuth: RouterAuth = {
  get user() {
    return snapshot.user;
  },
};

let teardownInit: (() => void) | null = null;
let lastUserId: string | null | undefined;

/**
 * Wires the store to Supabase: seeds from `getSession()` and tracks
 * subsequent auth events. Called once from `main.tsx`; calling again returns the
 * existing teardown. Supabase awaits its auth listeners inside `signIn`/`signOut`,
 * so the snapshot is already current when those calls resolve — readers never
 * see a stale user after an awaited auth call.
 *
 * `onUserChange` fires after the snapshot updates whenever the signed-in user's
 * id changes — sign-in, sign-out, or a different user. The first population
 * (initial session restore) only sets the baseline, and same-user re-emits
 * (token refresh, user update) don't fire.
 */
export function initAuthStore(options?: { onUserChange?: () => void }): () => void {
  if (teardownInit) return teardownInit;

  const applySession = (session: Session | null) => {
    setSnapshot({ session, user: session?.user ?? null, loading: false });

    const userId = session?.user?.id ?? null;
    if (lastUserId === undefined) {
      lastUserId = userId;
      return;
    }
    if (userId !== lastUserId) {
      lastUserId = userId;
      options?.onUserChange?.();
    }
  };

  void supabase.auth.getSession().then(({ data: { session } }) => {
    applySession(session);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    // Verifying a recovery token mints a session before the password actually
    // changes; the store acknowledges the user on USER_UPDATED, once the reset
    // has completed.
    if (event === 'PASSWORD_RECOVERY') return;
    applySession(session);
  });

  teardownInit = () => {
    subscription.unsubscribe();
    lastUserId = undefined;
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
