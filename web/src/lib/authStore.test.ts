import type { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAuthActions,
  getAuthSnapshot,
  initAuthStore,
  resetAuthStore,
  seedAuthStore,
  subscribeAuth,
} from './authStore';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: mockUser,
};

describe('authStore', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn<() => void>>;
  let authCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe = vi.fn<() => void>();
    authCallback = undefined;

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return {
        data: { subscription: { unsubscribe: mockUnsubscribe, id: 'test', callback: vi.fn() } },
      };
    });
  });

  describe('initial state', () => {
    it('starts loading with no user or session', () => {
      const snapshot = getAuthSnapshot();

      expect(snapshot.loading).toBe(true);
      expect(snapshot.user).toBeNull();
      expect(snapshot.session).toBeNull();
      expect(snapshot.isAuthTransitioning).toBe(false);
    });

    it('seeds from an existing session on init', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      initAuthStore();

      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });
      expect(getAuthSnapshot().user).toEqual(mockUser);
      expect(getAuthSnapshot().session).toEqual(mockSession);
    });

    it('finishes loading with no user when no session exists', async () => {
      initAuthStore();

      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });
      expect(getAuthSnapshot().user).toBeNull();
    });

    it('registers the auth state change listener once across repeat inits', () => {
      initAuthStore();
      initAuthStore();

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes from supabase on teardown', () => {
      const teardown = initAuthStore();

      teardown();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('auth state changes', () => {
    it('updates the snapshot synchronously when the listener fires', () => {
      initAuthStore();

      authCallback!('SIGNED_IN', mockSession);

      expect(getAuthSnapshot().user).toEqual(mockUser);
      expect(getAuthSnapshot().session).toEqual(mockSession);
      expect(getAuthSnapshot().loading).toBe(false);

      authCallback!('SIGNED_OUT', null);

      expect(getAuthSnapshot().user).toBeNull();
      expect(getAuthSnapshot().session).toBeNull();
    });

    it('notifies subscribers on every change and stops after unsubscribe', () => {
      initAuthStore();
      const listener = vi.fn();
      const unsubscribe = subscribeAuth(listener);

      authCallback!('SIGNED_IN', mockSession);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      authCallback!('SIGNED_OUT', null);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('signIn', () => {
    it('delegates to supabase with the credentials', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      await getAuthActions().signIn('test@example.com', 'password');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('throws the supabase error on failure', async () => {
      const signInError = new Error('Invalid credentials') as AuthError;
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: signInError,
      });

      await expect(getAuthActions().signIn('test@example.com', 'password')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('signUp', () => {
    it('delegates with the display name and default emailRedirectTo', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await getAuthActions().signUp('test@example.com', 'password', {
        displayName: 'Test User',
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        options: {
          data: {
            displayName: 'Test User',
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      expect(result.session).toEqual(mockSession);
    });

    it('forwards the emailRedirectTo option verbatim', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const customEmailRedirectTo = `${window.location.origin}/join/abc123`;

      await getAuthActions().signUp(
        'test@example.com',
        'password',
        { displayName: 'Test User' },
        { emailRedirectTo: customEmailRedirectTo },
      );

      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: customEmailRedirectTo,
          }),
        }),
      );
    });

    it('rejects a blank display name without calling supabase', async () => {
      await expect(
        getAuthActions().signUp('test@example.com', 'password', { displayName: '  ' }),
      ).rejects.toThrow('Display name is required');

      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('throws the supabase error on failure', async () => {
      const signUpError = new Error('Email already exists') as AuthError;
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: signUpError,
      });

      await expect(
        getAuthActions().signUp('test@example.com', 'password', { displayName: 'Test User' }),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('signOut', () => {
    it('delegates to supabase', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      await getAuthActions().signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('throws the supabase error on failure', async () => {
      const signOutError = new Error('Sign out failed') as AuthError;
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: signOutError });

      await expect(getAuthActions().signOut()).rejects.toThrow('Sign out failed');
    });
  });

  describe('auth transition flag', () => {
    it('flips on start and off on complete', () => {
      getAuthActions().startAuthTransition();
      expect(getAuthSnapshot().isAuthTransitioning).toBe(true);

      getAuthActions().completeAuthTransition();
      expect(getAuthSnapshot().isAuthTransitioning).toBe(false);
    });
  });

  describe('onUserChange gating', () => {
    it('does not fire for the initial session restore', async () => {
      const onUserChange = vi.fn();
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      initAuthStore({ onUserChange });

      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });
      authCallback!('INITIAL_SESSION', mockSession);

      expect(onUserChange).not.toHaveBeenCalled();
    });

    it('fires once on sign-in, after the snapshot holds the new user', async () => {
      const idsSeenByReaction: (string | undefined)[] = [];
      const onUserChange = vi.fn(() => {
        idsSeenByReaction.push(getAuthSnapshot().user?.id);
      });

      initAuthStore({ onUserChange });
      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });

      authCallback!('SIGNED_IN', mockSession);

      expect(onUserChange).toHaveBeenCalledTimes(1);
      expect(idsSeenByReaction).toEqual(['test-user-id']);
    });

    it('fires on sign-out', async () => {
      const onUserChange = vi.fn();
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      initAuthStore({ onUserChange });
      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });

      authCallback!('SIGNED_OUT', null);

      expect(onUserChange).toHaveBeenCalledTimes(1);
    });

    it('does not fire for a same-user token refresh', async () => {
      const onUserChange = vi.fn();
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      initAuthStore({ onUserChange });
      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });

      authCallback!('TOKEN_REFRESHED', { ...mockSession, access_token: 'rotated-token' });

      expect(onUserChange).not.toHaveBeenCalled();
    });

    it('fires once when switching users', async () => {
      const onUserChange = vi.fn();
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      initAuthStore({ onUserChange });
      await vi.waitFor(() => {
        expect(getAuthSnapshot().loading).toBe(false);
      });

      authCallback!('SIGNED_IN', {
        ...mockSession,
        user: { ...mockUser, id: 'other-user-id' },
      });

      expect(onUserChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('test seams', () => {
    it('seedAuthStore sets state fields and swaps in provided actions', async () => {
      const fakeSignOut = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      seedAuthStore({ user: mockUser, session: mockSession, loading: false, signOut: fakeSignOut });

      expect(getAuthSnapshot().user).toEqual(mockUser);
      expect(getAuthSnapshot().loading).toBe(false);

      await getAuthActions().signOut();
      expect(fakeSignOut).toHaveBeenCalled();
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });

    it('resetAuthStore restores the pristine snapshot and real actions', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
      seedAuthStore({ user: mockUser, loading: false, signOut: vi.fn() });

      resetAuthStore();

      expect(getAuthSnapshot().user).toBeNull();
      expect(getAuthSnapshot().loading).toBe(true);

      await getAuthActions().signOut();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('resetAuthStore tears down init wiring so a later init re-subscribes', () => {
      initAuthStore();

      resetAuthStore();
      expect(mockUnsubscribe).toHaveBeenCalled();

      initAuthStore();
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(2);
    });
  });
});
