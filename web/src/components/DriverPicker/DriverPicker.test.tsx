import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DriverPicker } from './DriverPicker';

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

    it('adds selected driver to slot and closes sheet', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);

      await screen.findByText('Select Driver');
      await selectDriverFromPool(user, 'Oscar Piastri');

      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });

      // Oscar Piastri should now appear as a selected driver (in heading)
      expect(screen.getByRole('heading', { name: 'Oscar Piastri' })).toBeInTheDocument();
      // Should have 4 empty slots remaining
      expect(screen.getAllByRole('button', { name: /add driver/i })).toHaveLength(4);
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

  describe('Driver Removal', () => {
    it('removes driver from slot when remove button is clicked', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      // Add a driver first
      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Driver');
      await selectDriverFromPool(user, 'Oscar Piastri');

      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });

      // Remove the driver using the remove button
      await user.click(screen.getByRole('button', { name: /remove role/i }));

      // Driver should be removed, all slots empty again
      expect(screen.queryByRole('heading', { name: 'Oscar Piastri' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /add driver/i })).toHaveLength(5);
    });
  });

  describe('Pool Management', () => {
    it('removes selected driver from available pool', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      // Open sheet and add Oscar Piastri
      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Driver');
      expect(screen.getAllByRole('listitem')).toHaveLength(5);

      await selectDriverFromPool(user, 'Oscar Piastri');

      // Open sheet again for second slot
      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });

      const remainingAddButtons = screen.getAllByRole('button', { name: /add driver/i });
      await user.click(remainingAddButtons[0]);
      await screen.findByText('Select Driver');

      // Pool should now have only 4 drivers (Oscar Piastri was removed)
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });

    it('returns removed driver back to available pool', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      // Add and then remove a driver
      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Driver');
      await selectDriverFromPool(user, 'Oscar Piastri');

      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /remove role/i }));

      // Open sheet to check pool
      const allAddButtons = screen.getAllByRole('button', { name: /add driver/i });
      await user.click(allAddButtons[0]);
      await screen.findByText('Select Driver');

      // Oscar Piastri should be back in the pool - all 5 drivers available
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
    });
  });

  describe('Multi-Driver Workflow', () => {
    it('handles adding multiple drivers to different slots', async () => {
      const user = userEvent.setup();
      render(<DriverPicker />);

      // Add first driver (Oscar Piastri)
      const addButtons = await screen.findAllByRole('button', { name: /add driver/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Driver');
      await selectDriverFromPool(user, 'Oscar Piastri');

      // Add second driver (Lando Norris)
      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });
      const remainingSlotButtons = screen.getAllByRole('button', { name: /add driver/i });
      await user.click(remainingSlotButtons[0]);
      await screen.findByText('Select Driver');
      await selectDriverFromPool(user, 'Lando Norris');

      await waitFor(() => {
        expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      });

      // Verify two drivers are selected (shown as headings in filled cards)
      expect(screen.getByRole('heading', { name: 'Oscar Piastri' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Lando Norris' })).toBeInTheDocument();
      // 3 empty slots remaining
      expect(screen.getAllByRole('button', { name: /add driver/i })).toHaveLength(3);
    });
  });
});
