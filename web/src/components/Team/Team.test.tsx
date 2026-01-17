import type { Team as TeamType } from '@/contracts/Team';
import { createMockTeam } from '@/test-utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Team } from './Team';

// Mock TanStack Router's useLoaderData hook
// The loader is tested separately - component tests focus on rendering with loaded data
const mockLoaderData = vi.fn<() => { team: TeamType }>();

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => mockLoaderData(),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

// Mock ResizeObserver for Radix UI components
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Mock child components to isolate Team component testing
vi.mock('../DriverPicker/DriverPicker', () => ({
  DriverPicker: vi.fn(({ lineupSize = 4 }) => (
    <div data-testid="driver-picker" data-lineup-size={lineupSize}>
      Mocked DriverPicker with {lineupSize} positions
    </div>
  )),
}));

vi.mock('../ConstructorPicker/ConstructorPicker', () => ({
  ConstructorPicker: vi.fn(({ lineupSize = 4 }) => (
    <div data-testid="constructor-picker" data-lineup-size={lineupSize}>
      Mocked ConstructorPicker with {lineupSize} positions
    </div>
  )),
}));

describe('Team Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns a valid team
    mockLoaderData.mockReturnValue({
      team: createMockTeam({
        id: 1,
        name: 'Test Team',
        ownerName: 'Test Owner',
      }),
    });
  });

  describe('Initial State', () => {
    it('renders team name from loader data', () => {
      render(<Team />);

      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    it('renders with drivers tab selected by default', () => {
      render(<Team />);

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      expect(driversTab).toHaveAttribute('aria-selected', 'true');

      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      expect(constructorsTab).toHaveAttribute('aria-selected', 'false');
    });

    it('displays drivers content by default', () => {
      render(<Team />);

      // Both pickers are mounted (for state preservation)
      expect(screen.getByTestId('driver-picker')).toBeInTheDocument();
      expect(screen.getByTestId('constructor-picker')).toBeInTheDocument();

      // But only drivers tab content should be visible to the user
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).not.toBeVisible();
    });

    it('renders both tab options', () => {
      render(<Team />);

      expect(screen.getByRole('tab', { name: /drivers/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /constructors/i })).toBeInTheDocument();
    });
  });

  describe('Component Navigation', () => {
    it('displays back to leagues navigation link', () => {
      render(<Team />);

      const backLink = screen.getByRole('link', { name: /back to leagues/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/leagues');
    });
  });

  describe('Tab Navigation', () => {
    it('switches to constructors tab when clicked', async () => {
      const user = userEvent.setup();
      render(<Team />);

      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      await user.click(constructorsTab);

      expect(constructorsTab).toHaveAttribute('aria-selected', 'true');

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      expect(driversTab).toHaveAttribute('aria-selected', 'false');
    });

    it('displays constructors content when constructors tab is selected', async () => {
      const user = userEvent.setup();
      render(<Team />);

      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      await user.click(constructorsTab);

      // Both pickers remain mounted
      expect(screen.getByTestId('driver-picker')).toBeInTheDocument();
      expect(screen.getByTestId('constructor-picker')).toBeInTheDocument();

      // But visibility is controlled to show only constructors
      expect(screen.getByTestId('driver-picker')).not.toBeVisible();
      expect(screen.getByTestId('constructor-picker')).toBeVisible();
    });

    it('switches back to drivers tab when clicked', async () => {
      const user = userEvent.setup();
      render(<Team />);

      // First switch to constructors
      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      await user.click(constructorsTab);

      // Then switch back to drivers
      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      await user.click(driversTab);

      expect(driversTab).toHaveAttribute('aria-selected', 'true');
      expect(constructorsTab).toHaveAttribute('aria-selected', 'false');

      // Verify drivers content is visible again
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).not.toBeVisible();
    });
  });

  describe('Content Delivery', () => {
    it('passes correct lineupSize to DriverPicker', () => {
      render(<Team />);

      const driverPicker = screen.getByTestId('driver-picker');
      expect(driverPicker).toHaveAttribute('data-lineup-size', '5');
    });

    it('passes correct lineupSize to ConstructorPicker', async () => {
      const user = userEvent.setup();
      render(<Team />);

      // Switch to constructors tab
      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      await user.click(constructorsTab);

      const constructorPicker = screen.getByTestId('constructor-picker');
      expect(constructorPicker).toHaveAttribute('data-lineup-size', '2');
    });

    it('ensures only one tab content is visible at a time', async () => {
      const user = userEvent.setup();
      render(<Team />);

      // Initially only drivers content should be visible
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).not.toBeVisible();

      // Switch to constructors
      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      await user.click(constructorsTab);

      // Now only constructors content should be visible
      expect(screen.getByTestId('driver-picker')).not.toBeVisible();
      expect(screen.getByTestId('constructor-picker')).toBeVisible();

      // Switch back to drivers
      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      await user.click(driversTab);

      // Back to drivers content only
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).not.toBeVisible();
    });
  });

  describe('User Experience', () => {
    it('maintains state consistency throughout interaction', async () => {
      const user = userEvent.setup();
      render(<Team />);

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });

      // Perform multiple tab switches
      await user.click(constructorsTab);
      await user.click(driversTab);
      await user.click(constructorsTab);
      await user.click(driversTab);

      // Final state should be consistent
      expect(driversTab).toHaveAttribute('aria-selected', 'true');
      expect(constructorsTab).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).not.toBeVisible();
    });

    it('provides clear indication of current tab selection', () => {
      render(<Team />);

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });

      // One tab should be selected, one should not
      expect(driversTab).toHaveAttribute('aria-selected', 'true');
      expect(constructorsTab).toHaveAttribute('aria-selected', 'false');
    });
  });
});
