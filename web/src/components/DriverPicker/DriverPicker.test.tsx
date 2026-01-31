import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Driver } from '@/contracts/Role';
import type { TeamDriver } from '@/contracts/Team';

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

const mockDrivers: Driver[] = [
  { id: 1, firstName: 'Oscar', lastName: 'Piastri', countryAbbreviation: 'AUS' },
  { id: 2, firstName: 'Lando', lastName: 'Norris', countryAbbreviation: 'GBR' },
  { id: 3, firstName: 'Charles', lastName: 'Leclerc', countryAbbreviation: 'MON' },
  { id: 4, firstName: 'Max', lastName: 'Verstappen', countryAbbreviation: 'NED' },
  { id: 5, firstName: 'Lewis', lastName: 'Hamilton', countryAbbreviation: 'GBR' },
];

// Helper to convert Driver to TeamDriver
const toTeamDriver = (driver: Driver, slotPosition: number): TeamDriver => ({
  ...driver,
  slotPosition,
  abbreviation: driver.lastName.slice(0, 3).toUpperCase(),
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
      render(<DriverPicker activeDrivers={mockDrivers} />);

      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(4);
    });

    it('displays existing drivers in correct positions', () => {
      const teamDrivers: TeamDriver[] = [
        toTeamDriver(mockDrivers[0], 0),
        toTeamDriver(mockDrivers[1], 1),
      ];

      mockDisplayLineup = [mockDrivers[0], mockDrivers[1], null, null];

      render(<DriverPicker activeDrivers={mockDrivers} teamDrivers={teamDrivers} />);

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

      render(<DriverPicker activeDrivers={mockDrivers} teamDrivers={teamDrivers} />);

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

    it('displays sheet with title and description when picker is open', () => {
      render(<DriverPicker activeDrivers={mockDrivers} />);

      expect(screen.getByText('Select Driver')).toBeInTheDocument();
      expect(
        screen.getByText('Choose a driver from the list below to add to your team.')
      ).toBeInTheDocument();
    });

    it('displays all available drivers from pool', () => {
      mockPool = mockDrivers; // All drivers available

      render(<DriverPicker activeDrivers={mockDrivers} />);

      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });

    it('only displays drivers not in current lineup', () => {
      mockDisplayLineup = [mockDrivers[0], null, null, null];
      mockPool = [mockDrivers[1], mockDrivers[2], mockDrivers[3], mockDrivers[4]];

      render(<DriverPicker activeDrivers={mockDrivers} teamDrivers={[toTeamDriver(mockDrivers[0], 0)]} />);

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

      render(<DriverPicker activeDrivers={mockDrivers} />);

      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
    });

    it('does not display sheet when operation is pending', () => {
      mockSelectedPosition = 0;
      mockIsPending = true;

      render(<DriverPicker activeDrivers={mockDrivers} />);

      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('hides picker sheet when operation is pending', () => {
      mockSelectedPosition = 0; // User tried to open picker
      mockIsPending = true; // But operation is pending

      render(<DriverPicker activeDrivers={mockDrivers} />);

      // Sheet should not be visible during pending operations
      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // Picker must be open to show errors
    });

    it('displays error message in picker when error occurs', () => {
      mockError = 'Failed to add driver. Please try again.';

      render(<DriverPicker activeDrivers={mockDrivers} />);

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to add driver. Please try again.');
    });

    it('does not display error when no error exists', () => {
      mockError = null;

      render(<DriverPicker activeDrivers={mockDrivers} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML with proper roles', () => {
      mockSelectedPosition = 0;

      render(<DriverPicker activeDrivers={mockDrivers} />);

      // Sheet should have dialog role
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // List of drivers should use list/listitem roles
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('provides descriptive button labels', async () => {
      render(<DriverPicker activeDrivers={mockDrivers} />);

      // Empty slot buttons should be clear
      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('provides aria-label for remove buttons', () => {
      mockDisplayLineup = [mockDrivers[0], null, null, null];

      render(<DriverPicker activeDrivers={mockDrivers} teamDrivers={[toTeamDriver(mockDrivers[0], 0)]} />);

      const removeButton = screen.getByRole('button', { name: /remove driver/i });
      expect(removeButton).toHaveAccessibleName('Remove driver');
    });
  });
});
