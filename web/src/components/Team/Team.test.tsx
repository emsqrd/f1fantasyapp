import type { Constructor, Driver } from '@/contracts/Role';
import type { Team as TeamType } from '@/contracts/Team';
import { createMockTeam } from '@/test-utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Team } from './Team';

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
const mockDriverPicker = vi.fn();
vi.mock('../DriverPicker/DriverPicker', () => ({
  DriverPicker: (props: {
    activeDrivers: Driver[];
    teamDrivers?: unknown[];
    readOnly: boolean;
  }) => {
    mockDriverPicker(props);
    return (
      <div
        data-testid="driver-picker"
        data-read-only={props.readOnly}
        data-active-drivers={props.activeDrivers.length}
      >
        Mocked DriverPicker (readOnly: {props.readOnly.toString()})
      </div>
    );
  },
}));

const mockConstructorPicker = vi.fn();
vi.mock('../ConstructorPicker/ConstructorPicker', () => ({
  ConstructorPicker: (props: {
    activeConstructors: Constructor[];
    teamConstructors?: unknown[];
  }) => {
    mockConstructorPicker(props);
    return (
      <div
        data-testid="constructor-picker"
        data-active-constructors={props.activeConstructors.length}
      >
        Mocked ConstructorPicker
      </div>
    );
  },
}));

describe('Team Component', () => {
  const mockTeam: TeamType = createMockTeam({
    id: 1,
    name: 'Test Team',
    ownerId: 1,
    ownerName: 'Test Owner',
  });

  const mockActiveDrivers: Driver[] = [
    {
      id: 1,
      firstName: 'Max',
      lastName: 'Verstappen',
      countryAbbreviation: 'NL',
    },
    {
      id: 2,
      firstName: 'Lewis',
      lastName: 'Hamilton',
      countryAbbreviation: 'GB',
    },
    {
      id: 3,
      firstName: 'Charles',
      lastName: 'Leclerc',
      countryAbbreviation: 'MC',
    },
  ];

  const mockActiveConstructors: Constructor[] = [
    {
      id: 1,
      name: 'Red Bull',
      fullName: 'Red Bull Racing',
      countryAbbreviation: 'AT',
    },
    {
      id: 2,
      name: 'Ferrari',
      fullName: 'Scuderia Ferrari',
      countryAbbreviation: 'IT',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('renders team name', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    it('renders with drivers tab selected by default', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      expect(driversTab).toHaveAttribute('aria-selected', 'true');

      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      expect(constructorsTab).toHaveAttribute('aria-selected', 'false');
    });

    it('displays drivers content by default', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      // Both pickers are mounted (for state preservation)
      expect(screen.getByTestId('driver-picker')).toBeInTheDocument();
      expect(screen.getByTestId('constructor-picker')).toBeInTheDocument();

      // But only drivers tab content should be visible to the user
      expect(screen.getByTestId('driver-picker')).toBeVisible();
      expect(screen.getByTestId('constructor-picker')).not.toBeVisible();
    });

    it('renders both tab options', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      expect(screen.getByRole('tab', { name: /drivers/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /constructors/i })).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to constructors tab when clicked', async () => {
      const user = userEvent.setup();
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });
      await user.click(constructorsTab);

      expect(constructorsTab).toHaveAttribute('aria-selected', 'true');

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      expect(driversTab).toHaveAttribute('aria-selected', 'false');
    });

    it('displays constructors content when constructors tab is selected', async () => {
      const user = userEvent.setup();
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

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
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

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
    it('passes props to DriverPicker correctly', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      expect(mockDriverPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          activeDrivers: mockActiveDrivers,
          teamDrivers: mockTeam.drivers,
          readOnly: false,
        }),
      );
    });

    it('passes props to ConstructorPicker correctly', async () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      expect(mockConstructorPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          activeConstructors: mockActiveConstructors,
          teamConstructors: mockTeam.constructors,
        }),
      );
    });

    it('ensures only one tab content is visible at a time', async () => {
      const user = userEvent.setup();
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

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
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

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
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      const driversTab = screen.getByRole('tab', { name: /drivers/i });
      const constructorsTab = screen.getByRole('tab', { name: /constructors/i });

      // One tab should be selected, one should not
      expect(driversTab).toHaveAttribute('aria-selected', 'true');
      expect(constructorsTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Read-Only Mode', () => {
    it('displays owner name when readOnly is true', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={true}
        />,
      );

      expect(screen.getByText('Owner: Test Owner')).toBeInTheDocument();
    });

    it('does not display owner name when readOnly is false', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      expect(screen.queryByText('Owner: Test Owner')).not.toBeInTheDocument();
    });

    it('passes readOnly=true to DriverPicker when in read-only mode', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={true}
        />,
      );

      expect(mockDriverPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
        }),
      );

      const driverPicker = screen.getByTestId('driver-picker');
      expect(driverPicker).toHaveAttribute('data-read-only', 'true');
    });

    it('passes readOnly=false to DriverPicker when not in read-only mode', () => {
      render(
        <Team
          team={mockTeam}
          activeDrivers={mockActiveDrivers}
          activeConstructors={mockActiveConstructors}
          readOnly={false}
        />,
      );

      expect(mockDriverPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: false,
        }),
      );

      const driverPicker = screen.getByTestId('driver-picker');
      expect(driverPicker).toHaveAttribute('data-read-only', 'false');
    });
  });
});
