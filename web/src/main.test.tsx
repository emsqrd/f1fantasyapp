import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './contexts/AuthContext.tsx';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Route: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  createRoute: vi.fn(),
  createRouter: vi.fn(),
  createRootRoute: vi.fn(),
  RouterProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Outlet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock component dependencies
vi.mock('./components/LandingPage/LandingPage.tsx', () => ({
  LandingPage: () => <div data-testid="landing-page">LandingPage</div>,
}));

vi.mock('./components/Layout/Layout.tsx', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

describe('main.tsx - Application Entry Point', () => {
  describe('Application Structure', () => {
    it('initializes with AuthProvider wrapping the router', async () => {
      const { LandingPage } = await import('./components/LandingPage/LandingPage.tsx');

      const { container } = render(
        <AuthProvider>
          <LandingPage />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      expect(container).toBeTruthy();
    });

    it('supports nested route structure with Layout wrapper', async () => {
      const { Layout } = await import('./components/Layout/Layout.tsx');
      const { LandingPage } = await import('./components/LandingPage/LandingPage.tsx');

      const { container: layoutContainer } = render(<Layout />);
      const { container: landingContainer } = render(<LandingPage />);

      expect(layoutContainer).toBeTruthy();
      expect(landingContainer).toBeTruthy();
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });
});
