import type { TeamContextType } from '@/contexts/TeamContext';
import { TeamContext } from '@/contexts/TeamContext';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useTeam } from './useTeam';

describe('useTeam', () => {
  it('throws error when used outside TeamProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTeam());
    }).toThrow('useTeam must be used within a TeamProvider');

    consoleSpy.mockRestore();
  });

  it('throws error when context is explicitly undefined', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTeam(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <TeamContext.Provider value={undefined}>{children}</TeamContext.Provider>
        ),
      });
    }).toThrow('useTeam must be used within a TeamProvider');

    consoleSpy.mockRestore();
  });

  it('returns context value when used within TeamProvider', () => {
    const mockContext: TeamContextType = {
      myTeamId: null,
      hasTeam: false,
      setMyTeamId: vi.fn(),
      refreshMyTeam: vi.fn(),
    };

    const { result } = renderHook(() => useTeam(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TeamContext.Provider value={mockContext}>{children}</TeamContext.Provider>
      ),
    });

    expect(result.current).toBe(mockContext);
  });
});
