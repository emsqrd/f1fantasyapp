import type { AuthContextType } from '@/contexts/AuthContext';
import { AuthContext } from '@/contexts/AuthContext';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('throws error when context is undefined', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthContext.Provider value={undefined}>{children}</AuthContext.Provider>
        ),
      });
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('returns context when context is defined', () => {
    const mockContext: AuthContextType = {
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AuthContext.Provider value={mockContext}>{children}</AuthContext.Provider>
      ),
    });

    expect(result.current).toBe(mockContext);
  });
});
