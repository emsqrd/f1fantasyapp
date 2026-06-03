import { avatarEvents } from '@/lib/avatarEvents';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSidebar } from './AppSidebar';

// Mock TanStack Router hooks
const mockNavigate = vi.fn();
const mockUseRouteContext = vi.fn();
const mockRouterState = { location: { pathname: '/' } };

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouteContext: () => mockUseRouteContext(),
  useRouterState: () => mockRouterState,
  useRouter: () => ({ invalidate: vi.fn() }),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useTeam hook
const mockUseTeam = vi.fn();
vi.mock('@/hooks/useTeam', () => ({
  useTeam: () => mockUseTeam(),
}));

// Mock next-themes
const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: mockSetTheme,
  }),
}));

// Mock avatar events
vi.mock('@/lib/avatarEvents', () => ({
  avatarEvents: {
    subscribe: vi.fn(),
  },
}));

// Mock UI components
vi.mock('../ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar">{children}</div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    onClick,
    isActive,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    isActive?: boolean;
  }) => (
    <button onClick={onClick} data-active={isActive}>
      {children}
    </button>
  ),
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock('../ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="avatar">{children}</div>
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src, onLoad }: { src?: string; onLoad?: () => void }) => {
    // Call onLoad asynchronously to avoid setState during render
    if (onLoad) {
      setTimeout(() => onLoad(), 0);
    }
    return <img src={src} alt="avatar" />;
  },
}));

describe('AppSidebar', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockProfile = {
    id: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseAuth.mockReturnValue({
      user: mockUser,
      signOut: vi.fn().mockResolvedValue(undefined),
      startAuthTransition: vi.fn(),
      completeAuthTransition: vi.fn(),
    });

    mockUseTeam.mockReturnValue({
      hasTeam: true,
      myTeamId: 123,
    });

    mockUseRouteContext.mockReturnValue({ profile: mockProfile });

    vi.mocked(avatarEvents.subscribe).mockReturnValue(() => {});
  });

  describe('Conditional Navigation Rendering', () => {
    it('renders team navigation when user has team', () => {
      mockUseTeam.mockReturnValue({
        hasTeam: true,
        myTeamId: 123,
      });

      render(<AppSidebar />);

      expect(screen.getByText('My Team')).toBeInTheDocument();
      expect(screen.getByText('My Leagues')).toBeInTheDocument();
      expect(screen.getByText('Browse Leagues')).toBeInTheDocument();
      expect(screen.queryByText('Create Team')).not.toBeInTheDocument();
    });

    it('renders create team navigation when user has no team', () => {
      mockUseTeam.mockReturnValue({
        hasTeam: false,
        myTeamId: null,
      });

      render(<AppSidebar />);

      expect(screen.getByText('Create Team')).toBeInTheDocument();
      expect(screen.queryByText('My Team')).not.toBeInTheDocument();
      expect(screen.queryByText('My Leagues')).not.toBeInTheDocument();
      expect(screen.queryByText('Browse Leagues')).not.toBeInTheDocument();
    });
  });

  describe('Logo Navigation', () => {
    it('navigates to home when logo is clicked', async () => {
      const user = userEvent.setup();
      render(<AppSidebar />);

      const logo = screen.getByLabelText('Navigate to home page');
      await user.click(logo);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('navigates to home when Enter key is pressed on logo', async () => {
      const user = userEvent.setup();
      render(<AppSidebar />);

      const logo = screen.getByLabelText('Navigate to home page');
      logo.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('navigates to home when Space key is pressed on logo', async () => {
      const user = userEvent.setup();
      render(<AppSidebar />);

      const logo = screen.getByLabelText('Navigate to home page');
      logo.focus();
      await user.keyboard(' ');

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  describe('Navigation Items', () => {
    it('navigates to my team when My Team is clicked', async () => {
      const user = userEvent.setup();
      mockUseTeam.mockReturnValue({
        hasTeam: true,
        myTeamId: 456,
      });

      render(<AppSidebar />);

      await user.click(screen.getByText('My Team'));

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/my-team',
      });
    });

    it('navigates to leagues when My Leagues is clicked', async () => {
      const user = userEvent.setup();
      render(<AppSidebar />);

      await user.click(screen.getByText('My Leagues'));

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/leagues' });
    });

    it('navigates to browse leagues when Browse Leagues is clicked', async () => {
      const user = userEvent.setup();
      render(<AppSidebar />);

      await user.click(screen.getByText('Browse Leagues'));

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/browse-leagues' });
    });

    it('navigates to create team when Create Team is clicked', async () => {
      const user = userEvent.setup();
      mockUseTeam.mockReturnValue({
        hasTeam: false,
        myTeamId: null,
      });

      render(<AppSidebar />);

      await user.click(screen.getByText('Create Team'));

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/create-team' });
    });
  });

  describe('Active State Highlighting', () => {
    it('marks My Team as active when on team page', () => {
      mockRouterState.location.pathname = '/my-team';
      const { container } = render(<AppSidebar />);

      const buttons = container.querySelectorAll('button[data-active="true"]');
      const activeButton = Array.from(buttons).find((btn) => btn.textContent?.includes('My Team'));

      expect(activeButton).toBeTruthy();
    });

    it('marks My Leagues as active when on leagues page', () => {
      mockRouterState.location.pathname = '/leagues';
      const { container } = render(<AppSidebar />);

      const buttons = container.querySelectorAll('button[data-active="true"]');
      const activeButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes('My Leagues'),
      );

      expect(activeButton).toBeTruthy();
    });

    it('marks Browse Leagues as active when on browse leagues page', () => {
      mockRouterState.location.pathname = '/browse-leagues';
      const { container } = render(<AppSidebar />);

      const buttons = container.querySelectorAll('button[data-active="true"]');
      const activeButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes('Browse Leagues'),
      );

      expect(activeButton).toBeTruthy();
    });

    it('marks Create Team as active when on create team page', () => {
      mockRouterState.location.pathname = '/create-team';
      mockUseTeam.mockReturnValue({
        hasTeam: false,
        myTeamId: null,
      });

      const { container } = render(<AppSidebar />);

      const buttons = container.querySelectorAll('button[data-active="true"]');
      const activeButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes('Create Team'),
      );

      expect(activeButton).toBeTruthy();
    });
  });
});
