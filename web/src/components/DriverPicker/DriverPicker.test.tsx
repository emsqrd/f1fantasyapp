import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DriverPicker } from './DriverPicker';

// Mock TanStack Router
const mockInvalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: mockInvalidate,
  }),
}));

// Mock the driver service (external API call - appropriate to mock)
const mockGetActiveDrivers = vi.fn();
vi.mock('@/services/driverService', () => ({
  getActiveDrivers: () => mockGetActiveDrivers(),
}));

// Mock the team service for persistence
const mockAddDriverToTeam = vi.fn();
const mockRemoveDriverFromTeam = vi.fn();
vi.mock('@/services/teamService', () => ({
  addDriverToTeam: (...args: unknown[]) => mockAddDriverToTeam(...args),
  removeDriverFromTeam: (...args: unknown[]) => mockRemoveDriverFromTeam(...args),
}));

const mockDrivers = [
  { id: 1, firstName: 'Oscar', lastName: 'Piastri', countryAbbreviation: 'AUS' },
  { id: 2, firstName: 'Lando', lastName: 'Norris', countryAbbreviation: 'GBR' },
  { id: 3, firstName: 'Charles', lastName: 'Leclerc', countryAbbreviation: 'MON' },
  { id: 4, firstName: 'Max', lastName: 'Verstappen', countryAbbreviation: 'NED' },
  { id: 5, firstName: 'Lewis', lastName: 'Hamilton', countryAbbreviation: 'GBR' },
];

// Helper to find and click a driver's add button in the pool list within the sheet
async function selectDriverFromPool(user: ReturnType<typeof userEvent.setup>, driverName: string) {
  // Find the list item containing the driver name, then click its add button
  const listItems = screen.getAllByRole('listitem');
  const targetItem = listItems.find((item) => item.textContent?.includes(driverName));
  if (!targetItem) {
    throw new Error(`Could not find list item for driver: ${driverName}`);
  }
  const addButton = within(targetItem).getByRole('button', { name: /add driver/i });
  await user.click(addButton);
}

describe('DriverPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveDrivers.mockResolvedValue(mockDrivers);
    mockAddDriverToTeam.mockResolvedValue(undefined);
    mockRemoveDriverFromTeam.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('displays loading indicator while fetching drivers', () => {
      // Keep promise pending to observe loading state
      mockGetActiveDrivers.mockReturnValue(new Promise(() => {}));

      render(<DriverPicker />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading Drivers...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when driver fetch fails', async () => {
      mockGetActiveDrivers.mockRejectedValue(new Error('Network error'));

      render(<DriverPicker />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load active drivers');
    });
  });

  describe('Slot Rendering', () => {
    it('renders default of 5 empty slots when loaded', async () => {
      render(<DriverPicker />);

      // Wait for loading to complete, then find "Add Driver" buttons in slot cards
      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(5);
    });

    it('renders custom slot count when specified', async () => {
      render(<DriverPicker lineupSize={2} />);

      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(2);
    });
  });

  describe('Driver Selection Flow', () => {
    it('opens selection sheet and displays available drivers when clicking add button', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);

      // Sheet should open with title and description
      expect(await screen.findByText('Select Driver')).toBeInTheDocument();
      expect(
        screen.getByText('Choose a driver from the list below to add to your team.'),
      ).toBeInTheDocument();

      // All 5 drivers should be available in the pool as list items
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });

    it('calls add service and invalidates router when driver is selected', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);

      await screen.findByText('Select Driver');
      await selectDriverFromPool(user, 'Oscar Piastri');

      await waitFor(() => {
        expect(mockAddDriverToTeam).toHaveBeenCalledWith(1, 0);
        expect(mockInvalidate).toHaveBeenCalled();
      });

      // Verify sheet closes after selection
      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });
    });

    it('closes sheet without selecting when pressing escape', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);

      await screen.findByText('Select Driver');
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });

      // All 5 slots should still be empty
      expect(screen.getAllByRole('button', { name: /add driver/i })).toHaveLength(5);
    });
  });

  describe('Pool Management', () => {
    it('excludes drivers in lineup from available pool', async () => {
      const user = userEvent.setup();
      const currentDrivers = [
        mockDrivers[0], // Oscar Piastri
        null,
        null,
        null,
        null,
      ];
      render(<DriverPicker currentDrivers={currentDrivers} />);

      // Verify driver is displayed in lineup
      expect(await screen.findByRole('heading', { name: 'Oscar Piastri' })).toBeInTheDocument();

      // Open sheet for second slot
      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Driver');

      // Pool should have only 4 drivers (Oscar Piastri is already in lineup)
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
      // Verify Oscar Piastri is not in the pool
      expect(within(screen.getByRole('list')).queryByText('Oscar Piastri')).not.toBeInTheDocument();
    });

    it('includes all drivers in pool when lineup is empty', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Driver');

      // All 5 drivers should be available in the pool
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });
  });

  describe('Multi-Driver Workflow', () => {
    it('displays multiple drivers when provided via currentDrivers prop', async () => {
      const currentDrivers = [
        mockDrivers[0], // Oscar Piastri
        mockDrivers[1], // Lando Norris
        null,
        null,
        null,
      ];
      render(<DriverPicker currentDrivers={currentDrivers} />);

      // Verify both drivers are displayed (shown as headings in filled cards)
      expect(await screen.findByRole('heading', { name: 'Oscar Piastri' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Lando Norris' })).toBeInTheDocument();
      // 3 empty slots remaining
      expect(screen.getAllByRole('button', { name: /add driver/i })).toHaveLength(3);
    });
  });
});
