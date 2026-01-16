import type { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { userProfileService } from '../services/userProfileService';
import { AuthProvider } from './AuthContext.tsx';

// Mock modules with factory functions to avoid hoisting issues
vi.mock('../lib/supabase', () => ({
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

vi.mock('../services/userProfileService', () => ({
  userProfileService: {
    registerUser: vi.fn(),
  },
}));

// Test component that consumes the auth context
function TestComponent() {
  const { user, session, loading, signIn, signUp, signOut } = useAuth();

  const handleSignIn = async () => {
    try {
      await signIn('test@example.com', 'password');
    } catch {
      // Errors are expected in some tests, silently handle them
    }
  };

  const handleSignUp = async () => {
    try {
      await signUp('test@example.com', 'password', { displayName: 'Test User' });
    } catch {
      // Errors are expected in some tests, silently handle them
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Errors are expected in some tests, silently handle them
    }
  };

  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="user">{user?.email ?? 'null'}</div>
      <div data-testid="session">{session ? 'active' : 'null'}</div>
      <button onClick={handleSignIn} data-testid="sign-in-btn">
        Sign In
      </button>
      <button onClick={handleSignUp} data-testid="sign-up-btn">
        Sign Up
      </button>
      <button onClick={handleSignOut} data-testid="sign-out-btn">
        Sign Out
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
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

  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe = vi.fn();

    // Default mock setup
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe, id: 'test', callback: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should provide initial loading state', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      expect(screen.getByTestId('loading').textContent).toBe('true');
      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('session').textContent).toBe('null');

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });

    it('should load existing session on mount', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
        expect(screen.getByTestId('session').textContent).toBe('active');
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });

    it('should set up auth state change listener', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(expect.any(Function));

      // Wait for initial async setup to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });

    it('should clean up subscription on unmount', () => {
      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Auth Methods', () => {
    it('should call signIn and handle success', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await userEvent.click(screen.getByTestId('sign-in-btn'));

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should handle signIn error', async () => {
      const signInError = new Error('Invalid credentials') as AuthError;
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: signInError,
      });

      let thrownError: Error | null = null;
      function TestErrorComponent() {
        const { signIn } = useAuth();

        React.useEffect(() => {
          signIn('test@example.com', 'password').catch((err) => {
            thrownError = err;
          });
        }, [signIn]);

        return null;
      }

      render(
        <AuthProvider>
          <TestErrorComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(thrownError?.message).toBe('Invalid credentials');
      });
    });

    it('should call signUp and handle success', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await userEvent.click(screen.getByTestId('sign-up-btn'));

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        options: {
          data: {
            displayName: 'Test User',
          },
        },
      });
    });

    it('should handle signUp error', async () => {
      const signUpError = new Error('Email already exists') as AuthError;
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: signUpError,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      // Verify that signUp is called with correct parameters
      // The error will be thrown internally by the auth method
      await userEvent.click(screen.getByTestId('sign-up-btn'));

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        options: {
          data: {
            displayName: 'Test User',
          },
        },
      });
    });

    it('should not attempt profile creation if signUp returns no user', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await userEvent.click(screen.getByTestId('sign-up-btn'));

      expect(supabase.auth.signUp).toHaveBeenCalled();
      expect(userProfileService.registerUser).not.toHaveBeenCalled();
    });

    it('should call signOut', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await userEvent.click(screen.getByTestId('sign-out-btn'));

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle signOut error', async () => {
      const signOutError = new Error('Sign out failed') as AuthError;
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: signOutError,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      // Verify that signOut is called
      await userEvent.click(screen.getByTestId('sign-out-btn'));

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Auth State Changes', () => {
    it('should update state when auth changes', async () => {
      let authCallback: (event: AuthChangeEvent, session: Session | null) => void;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: mockUnsubscribe, id: 'test', callback: vi.fn() } },
        };
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      // Initially no user
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('user').textContent).toBe('null');

      // Simulate auth change with session - wrap in waitFor to handle state updates
      await waitFor(() => {
        authCallback!('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
        expect(screen.getByTestId('session').textContent).toBe('active');
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Simulate sign out - wrap in waitFor to handle state updates
      await waitFor(() => {
        authCallback!('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null');
        expect(screen.getByTestId('session').textContent).toBe('null');
      });
    });
  });
});
