import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Layout } from './Layout';

// Mock TanStack Router
const mockNavigate = vi.fn();
const mockUseMatches = vi.fn();
const mockOutlet = vi.fn(() => <div>Page Content</div>);

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useMatches: () => mockUseMatches(),
  Outlet: () => mockOutlet(),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock AppSidebar
vi.mock('../AppSidebar/AppSidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">App Sidebar</div>,
}));

// Mock sidebar components
vi.mock('../ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button data-testid="sidebar-trigger" className={className}>
      Toggle Sidebar
    </button>
  ),
}));

// Mock Button component
vi.mock('../ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
}));

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated Layout', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null });
      mockUseMatches.mockReturnValue([]);
    });

    it('navigates to home when logo is clicked', async () => {
      const user = userEvent.setup();
      render(<Layout />);

      const logo = screen.getByLabelText('Navigate to home page');
      await user.click(logo);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('navigates to home when Enter key is pressed on logo', async () => {
      const user = userEvent.setup();
      render(<Layout />);

      const logo = screen.getByLabelText('Navigate to home page');
      logo.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('navigates to home when Space key is pressed on logo', async () => {
      const user = userEvent.setup();
      render(<Layout />);

      const logo = screen.getByLabelText('Navigate to home page');
      logo.focus();
      await user.keyboard(' ');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('navigates to sign in page when Sign In button is clicked', async () => {
      const user = userEvent.setup();
      render(<Layout />);

      const signInButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(signInButton);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in' });
    });

    it('navigates to sign up page when Sign Up button is clicked', async () => {
      const user = userEvent.setup();
      render(<Layout />);

      const signUpButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(signUpButton);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-up' });
    });

    it('does not render sidebar components when unauthenticated', () => {
      render(<Layout />);

      expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sidebar-provider')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Layout', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com' },
      });
      mockUseMatches.mockReturnValue([]);
    });

    it('renders sidebar layout instead of auth buttons', () => {
      render(<Layout />);

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
      expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
    });

    it('displays page title when provided in route staticData', () => {
      mockUseMatches.mockReturnValue([
        {
          routeId: 'teams',
          staticData: { pageTitle: 'My Team' },
        },
      ]);

      render(<Layout />);

      expect(screen.getByRole('heading', { level: 1, name: 'My Team' })).toBeInTheDocument();
    });

    it('displays page title from deepest route when multiple routes have titles', () => {
      mockUseMatches.mockReturnValue([
        {
          routeId: 'root',
          staticData: { pageTitle: 'Root Title' },
        },
        {
          routeId: 'parent',
          staticData: { pageTitle: 'Parent Title' },
        },
        {
          routeId: 'child',
          staticData: { pageTitle: 'Child Title' },
        },
      ]);

      render(<Layout />);

      expect(screen.getByRole('heading', { level: 1, name: 'Child Title' })).toBeInTheDocument();
      expect(screen.queryByText('Root Title')).not.toBeInTheDocument();
      expect(screen.queryByText('Parent Title')).not.toBeInTheDocument();
    });

    it('does not display page title when no route has staticData.pageTitle', () => {
      mockUseMatches.mockReturnValue([
        {
          routeId: 'some-route',
          staticData: {},
        },
      ]);

      render(<Layout />);

      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });
  });
});
