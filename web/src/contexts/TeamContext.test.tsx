import { createMockTeam } from '@/test-utils';
import type { User } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocking
import { useAuth } from '../hooks/useAuth';
import { useTeam } from '../hooks/useTeam';
import { getMyTeam } from '../services/teamService';
import { TeamProvider } from './TeamContext.tsx';

// Mock modules
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/teamService', () => ({
  getMyTeam: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
  },
  captureException: vi.fn(),
}));

// Test component that consumes the team context
function TestComponent() {
  const { myTeamId, hasTeam, setMyTeamId, refreshMyTeam } = useTeam();

  const handleRefreshTeam = () => {
    refreshMyTeam();
  };

  return (
    <div>
      <div role="status" aria-label="Team ID">
        {myTeamId ?? 'null'}
      </div>
      <div role="status" aria-label="Has Team">
        {hasTeam.toString()}
      </div>
      <button onClick={() => setMyTeamId(1)}>Set Team Id</button>
      <button onClick={handleRefreshTeam}>Refresh Team</button>
    </div>
  );
}

describe('TeamProvider', () => {
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

  const mockTeam = createMockTeam();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup - authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('loads existing team when refreshMyTeam is called', async () => {
      const user = userEvent.setup();
      vi.mocked(getMyTeam).mockResolvedValue(mockTeam);

      render(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      // Initially no team
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'false',
      );

      // Manually trigger refresh
      await user.click(screen.getByRole('button', { name: /refresh team/i }));

      expect(
        await screen.findByRole('status', { name: /team id/i }),
      ).toHaveTextContent('1');
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'true',
      );
    });

    it('handles no team when user has no team', async () => {
      const user = userEvent.setup();
      vi.mocked(getMyTeam).mockResolvedValue(null);

      render(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'false',
      );

      // Trigger refresh - should still be null
      await user.click(screen.getByRole('button', { name: /refresh team/i }));

      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'false',
      );
    });

    it('does not fetch team when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      render(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      expect(getMyTeam).not.toHaveBeenCalled();
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'false',
      );
    });
  });

  describe('Team Management', () => {
    it('refreshes team when refreshMyTeam is called', async () => {
      const user = userEvent.setup();
      vi.mocked(getMyTeam).mockResolvedValue(mockTeam);

      render(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      // Initially no team
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );

      // First refresh
      await user.click(screen.getByRole('button', { name: /refresh team/i }));
      expect(
        await screen.findByRole('status', { name: /team id/i }),
      ).toHaveTextContent('1');

      // Update mock and refresh again
      const updatedTeam = createMockTeam({ id: 3, name: 'Refreshed Team' });
      vi.mocked(getMyTeam).mockResolvedValue(updatedTeam);

      await user.click(screen.getByRole('button', { name: /refresh team/i }));

      expect(
        await screen.findByRole('status', { name: /team id/i }),
      ).toHaveTextContent('3');

      expect(getMyTeam).toHaveBeenCalledTimes(2);
    });

    it('handles error during team fetch silently', async () => {
      const user = userEvent.setup();
      const fetchError = new Error('Failed to fetch team');
      vi.mocked(getMyTeam).mockRejectedValue(fetchError);

      render(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      // Initially null
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'false',
      );

      // Try to refresh - should handle error silently
      await user.click(screen.getByRole('button', { name: /refresh team/i }));

      // Error is handled silently, team ID remains null
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'false',
      );
    });
  });

  describe('User State Changes', () => {
    it('can fetch team after user changes from null to authenticated', async () => {
      const user = userEvent.setup();

      // Start with no user
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      const { rerender } = render(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      expect(getMyTeam).not.toHaveBeenCalled();
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );

      // User logs in
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(getMyTeam).mockResolvedValue(mockTeam);

      rerender(
        <TeamProvider>
          <TestComponent />
        </TeamProvider>,
      );

      // Team is still null until manually refreshed
      expect(screen.getByRole('status', { name: /team id/i })).toHaveTextContent(
        'null',
      );

      // Manually trigger refresh
      await user.click(screen.getByRole('button', { name: /refresh team/i }));

      expect(
        await screen.findByRole('status', { name: /team id/i }),
      ).toHaveTextContent('1');
      expect(screen.getByRole('status', { name: /has team/i })).toHaveTextContent(
        'true',
      );
    });
  });
});
