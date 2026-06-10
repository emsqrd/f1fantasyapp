import { getAuthActions, getAuthSnapshot, initAuthStore } from '@/lib/authStore';
import { server } from '@/setupTests';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SUPABASE_AUTH_BASE = 'http://localhost/auth/v1';

const sessionPayload = {
  access_token: 'test-header.test-payload.test-signature',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  user: {
    id: 'timing-test-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'timing@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
};

describe('authStore listener timing (real supabase client)', () => {
  afterEach(() => {
    localStorage.clear();
  });

  function stubAuthEndpoints() {
    server.use(
      http.post(`${SUPABASE_AUTH_BASE}/token`, () => HttpResponse.json(sessionPayload)),
      http.post(`${SUPABASE_AUTH_BASE}/logout`, () => new HttpResponse(null, { status: 204 })),
    );
  }

  // The store's design rests on supabase-js awaiting its onAuthStateChange
  // listeners inside signIn/signOut, so guards and loaders that run right after
  // an awaited auth call read the new state. The assertions deliberately use no
  // waitFor: if a supabase-js upgrade stops awaiting listeners, this fails.
  it('exposes the new auth state the moment signIn and signOut resolve', async () => {
    stubAuthEndpoints();

    const teardown = initAuthStore();
    try {
      await vi.waitFor(() => expect(getAuthSnapshot().loading).toBe(false));

      await getAuthActions().signIn('timing@example.com', 'password');
      expect(getAuthSnapshot().user?.id).toBe('timing-test-user');
      expect(getAuthSnapshot().session).not.toBeNull();

      await getAuthActions().signOut();
      expect(getAuthSnapshot().user).toBeNull();
      expect(getAuthSnapshot().session).toBeNull();
    } finally {
      teardown();
    }
  });

  // Guards against supabase emitting duplicate events for one auth call —
  // each extra firing would be a redundant cache wipe and router reload.
  it('fires onUserChange exactly once per sign-in and once per sign-out', async () => {
    stubAuthEndpoints();
    const onUserChange = vi.fn();

    const teardown = initAuthStore({ onUserChange });
    try {
      await vi.waitFor(() => expect(getAuthSnapshot().loading).toBe(false));

      await getAuthActions().signIn('timing@example.com', 'password');
      expect(onUserChange).toHaveBeenCalledTimes(1);

      await getAuthActions().signOut();
      expect(onUserChange).toHaveBeenCalledTimes(2);
    } finally {
      teardown();
    }
  });
});
