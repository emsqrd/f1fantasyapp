import type { Driver } from '@/contracts/Role';
import type { TeamDriver } from '@/contracts/Team';
import { createMockDriver, createMockDriverList } from '@/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DriverPicker } from './DriverPicker';

// Mock useLineupPicker hook
vi.mock('@/hooks/useLineupPicker', () => ({
  useLineupPicker: () => ({
    displayLineup: mockDisplayLineup,
    pool: mockPool,
    selectedPosition: mockSelectedPosition,
    isPending: mockIsPending,
    error: mockError,
    openPicker: vi.fn(),
    closePicker: vi.fn(),
    handleAdd: vi.fn(),
    handleRemove: vi.fn(),
  }),
}));

// Mock data - will be set in beforeEach or individual tests
let mockDisplayLineup: (Driver | null)[];
let mockPool: Driver[];
let mockSelectedPosition: number | null;
let mockIsPending: boolean;
let mockError: string | null;

const mockDrivers: Driver[] = createMockDriverList([
  { firstName: 'Oscar', lastName: 'Piastri', abbreviation: 'PIA', countryAbbreviation: 'AUS' },
  { firstName: 'Lando', lastName: 'Norris', abbreviation: 'NOR', countryAbbreviation: 'GBR' },
  { firstName: 'Charles', lastName: 'Leclerc', abbreviation: 'LEC', countryAbbreviation: 'MON' },
  { firstName: 'Max', lastName: 'Verstappen', abbreviation: 'VER', countryAbbreviation: 'NED' },
  { firstName: 'Lewis', lastName: 'Hamilton', abbreviation: 'HAM', countryAbbreviation: 'GBR' },
]);

// Helper to convert Driver to TeamDriver
const toTeamDriver = (driver: Driver, slotPosition: number, isCaptain = false): TeamDriver => ({
  ...driver,
  slotPosition,
  isCaptain,
});

describe('DriverPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default state: empty lineup, all drivers in pool, picker closed
    mockDisplayLineup = [null, null, null, null];
    mockPool = mockDrivers;
    mockSelectedPosition = null;
    mockIsPending = false;
    mockError = null;
  });

  describe('Lineup Rendering', () => {
    it('renders 4 empty driver slots by default', () => {
      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(4);
    });

    it('displays existing drivers in correct positions', () => {
      const teamDrivers: TeamDriver[] = [
        toTeamDriver(mockDrivers[0], 0),
        toTeamDriver(mockDrivers[1], 1),
      ];

      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={teamDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();

      // Two filled slots, two empty
      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(2);
    });

    it('displays all drivers when lineup is full', () => {
      const teamDrivers: TeamDriver[] = [
        toTeamDriver(mockDrivers[0], 0),
        toTeamDriver(mockDrivers[1], 1),
        toTeamDriver(mockDrivers[2], 2),
        toTeamDriver(mockDrivers[3], 3),
      ];

      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], mockDrivers[2], mockDrivers[3]];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={teamDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();

      // No "Add Driver" buttons when all slots are filled
      expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    });
  });

  describe('Picker Sheet', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // Picker is open
    });

    it('displays all available drivers from pool', () => {
      mockPool = mockDrivers; // All drivers available

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });

    it('only displays drivers not in current lineup', () => {
      mockDisplayLineup = [mockDrivers[0], null, null, null];
      mockPool = [mockDrivers[1], mockDrivers[2], mockDrivers[3], mockDrivers[4]];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Get the list element (pool) within the sheet
      const poolList = screen.getByRole('list');

      // Oscar Piastri should not appear in the pool (already in lineup)
      expect(poolList.textContent).not.toContain('Oscar Piastri');

      // Other drivers should appear in the pool
      expect(poolList.textContent).toContain('Lando Norris');
      expect(poolList.textContent).toContain('Charles Leclerc');
      expect(poolList.textContent).toContain('Max Verstappen');
      expect(poolList.textContent).toContain('Lewis Hamilton');
    });

    it('does not display sheet when picker is closed', () => {
      mockSelectedPosition = null;

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
    });

    it('keeps sheet open when operation is pending', () => {
      mockSelectedPosition = 0;
      mockIsPending = true;

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      // Sheet should remain open during pending operations
      expect(screen.getByText('Select Driver')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message above grid when error occurs', () => {
      mockError = 'Failed to add driver. Please try again.';

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to add driver. Please try again.');
    });

    it('displays error regardless of picker state', () => {
      mockError = 'Failed to add driver. Please try again.';
      mockSelectedPosition = null; // Picker closed

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      // Error should still be visible even when picker is closed
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to add driver. Please try again.');
    });

    it('does not display error when no error exists', () => {
      mockError = null;

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML with proper roles', () => {
      mockSelectedPosition = 0;

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      // Sheet should have dialog role
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // List of drivers should use list/listitem roles
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('provides descriptive button labels', async () => {
      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      // Empty slot buttons should be clear
      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('provides aria-label for remove buttons', () => {
      mockDisplayLineup = [mockDrivers[0], null, null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove driver/i });
      expect(removeButton).toHaveAccessibleName('Remove driver');
    });
  });

  describe('Read-Only Mode', () => {
    it('does not render picker sheet when readOnly is true', () => {
      mockSelectedPosition = 0; // Even if picker would be "open"

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={true} remainingBudget={100_000_000} />,
      );

      // Sheet should not be rendered
      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays driver lineup in read-only mode', () => {
      const teamDrivers: TeamDriver[] = [
        toTeamDriver(mockDrivers[0], 0),
        toTeamDriver(mockDrivers[1], 1),
      ];

      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={teamDrivers}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      // Drivers should still be displayed
      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
    });

    it('displays errors in read-only mode', () => {
      mockError = 'Failed to load team data.';

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={true} remainingBudget={100_000_000} />,
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to load team data.');
    });

    it('does not render picker sheet when readOnly is false and picker is closed', () => {
      mockSelectedPosition = null;

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      // Sheet should not be rendered when picker is closed
      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
    });
  });

  describe('Captain', () => {
    it('shows active captain button for the driver matching captainDriverId', () => {
      mockDisplayLineup = [mockDrivers[0], null, null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={mockDrivers[0].id}
          onSetCaptain={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /captain.*active/i })).toBeInTheDocument();
    });

    it('calls onSetCaptain with driver id when Set as captain is clicked', async () => {
      const user = userEvent.setup();
      const onSetCaptain = vi.fn();
      mockDisplayLineup = [mockDrivers[0], null, null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={null}
          onSetCaptain={onSetCaptain}
        />,
      );

      await user.click(screen.getByRole('button', { name: /set.*captain/i }));

      expect(onSetCaptain).toHaveBeenCalledWith(mockDrivers[0].id);
    });

    it('calls onSetCaptain with null when active captain button is clicked', async () => {
      const user = userEvent.setup();
      const onSetCaptain = vi.fn();
      mockDisplayLineup = [mockDrivers[0], null, null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0, true)]}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={mockDrivers[0].id}
          onSetCaptain={onSetCaptain}
        />,
      );

      await user.click(screen.getByRole('button', { name: /captain.*active/i }));

      expect(onSetCaptain).toHaveBeenCalledWith(null);
    });
  });

  describe('Captain Prompt Banner', () => {
    it('shows banner when roster is full and no captain selected', () => {
      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], mockDrivers[2], mockDrivers[3]];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={null}
          onSetCaptain={vi.fn()}
        />,
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/select your captain/i);
    });

    it('does not show banner when a captain is already selected', () => {
      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], mockDrivers[2], mockDrivers[3]];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={mockDrivers[0].id}
          onSetCaptain={vi.fn()}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not show banner when roster is not full', () => {
      mockDisplayLineup = [mockDrivers[0], null, null, null];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={null}
          onSetCaptain={vi.fn()}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not show banner in read-only mode', () => {
      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], mockDrivers[2], mockDrivers[3]];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          readOnly={true}
          remainingBudget={100_000_000}
          captainDriverId={null}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Budget Filtering', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // picker open
    });

    it('disables drivers that exceed remaining budget', () => {
      mockPool = [createMockDriver({ id: 99, price: 25_000_000 })];

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={10_000_000} />,
      );

      expect(screen.getByRole('button', { name: /add driver/i })).toBeDisabled();
    });

    it('does not disable drivers within remaining budget', () => {
      mockPool = [createMockDriver({ id: 98, price: 5_000_000 })];

      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={10_000_000} />,
      );

      expect(screen.getByRole('button', { name: /add driver/i })).not.toBeDisabled();
    });
  });
});
