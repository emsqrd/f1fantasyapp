import type { Constructor, Driver } from '@/contracts/Role';
import { createMockDriver } from '@/test-utils';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LineupPicker } from './LineupPicker';

// Mock TanStack Router
const mockInvalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: mockInvalidate,
  }),
}));

// Mock card component for testing
function MockDriverCard({
  item,
  onClick,
  onRemove,
}: {
  item: Driver | null;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div data-testid="driver-card">
      {item ? (
        <>
          <span>
            {item.firstName} {item.lastName}
          </span>
          <button onClick={onClick}>Change</button>
          <button onClick={onRemove}>Remove</button>
        </>
      ) : (
        <button onClick={onClick}>Add Driver</button>
      )}
    </div>
  );
}

// Mock list item component for testing
function MockDriverListItem({ item, onSelect }: { item: Driver; onSelect: () => void }) {
  return (
    <li data-testid="driver-list-item">
      <button onClick={onSelect}>
        {item.firstName} {item.lastName}
      </button>
    </li>
  );
}

// Mock constructor components
function MockConstructorCard({
  item,
  onClick,
  onRemove,
}: {
  item: Constructor | null;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div data-testid="constructor-card">
      {item ? (
        <>
          <span>{item.name}</span>
          <button onClick={onClick}>Change</button>
          <button onClick={onRemove}>Remove</button>
        </>
      ) : (
        <button onClick={onClick}>Add Constructor</button>
      )}
    </div>
  );
}

function MockConstructorListItem({ item, onSelect }: { item: Constructor; onSelect: () => void }) {
  return (
    <li data-testid="constructor-list-item">
      <button onClick={onSelect}>{item.name}</button>
    </li>
  );
}

describe('LineupPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvalidate.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('displays loading message while fetching items', () => {
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>(() => new Promise(() => {})); // Never resolves

      render(
        <LineupPicker<Driver>
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading Drivers...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when fetch fails', async () => {
      const mockFetchItems = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <LineupPicker<Driver>
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load drivers');
    });
  });

  describe('Initial Rendering with Drivers', () => {
    it('renders correct number of empty cards', async () => {
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={5}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const cards = await screen.findAllByTestId('driver-card');
      expect(cards).toHaveLength(5);
    });

    it('renders cards with initial items', async () => {
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={3}
          lineup={initialDrivers}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      expect(await screen.findByText('Max Verstappen')).toBeInTheDocument();
    });

    it('uses default lineupSize of 5 when not provided', async () => {
      const mockDrivers = [createMockDriver({ id: 1 })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const cards = await screen.findAllByTestId('driver-card');
      expect(cards).toHaveLength(5);
    });
  });

  describe('Selection Sheet Interaction', () => {
    it('opens selection sheet when clicking empty card', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver from the list"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      expect(screen.getByRole('heading', { name: 'Select Driver' })).toBeInTheDocument();
      expect(screen.getByText('Choose a driver from the list')).toBeInTheDocument();
    });

    it('displays available items in selection sheet', async () => {
      const user = userEvent.setup();
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      const listItems = screen.getAllByTestId('driver-list-item');
      expect(listItems).toHaveLength(2);
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });

    it('closes sheet after selecting item', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={mockAddToTeam}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      const selectButton = within(screen.getByTestId('driver-list-item')).getByRole('button');
      await user.click(selectButton);

      await waitFor(() => {
        expect(mockAddToTeam).toHaveBeenCalledWith(1, 0);
        expect(mockInvalidate).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Select Driver' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Adding Items', () => {
    it('calls addToTeam with correct parameters and invalidates router', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={mockAddToTeam}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      const selectButton = within(screen.getByTestId('driver-list-item')).getByRole('button');
      await user.click(selectButton);

      await waitFor(() => {
        expect(mockAddToTeam).toHaveBeenCalledWith(1, 0);
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });

    it('displays selected item when provided via lineup prop', async () => {
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          lineup={[mockDrivers[0], null]}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      });
    });

    it('excludes drivers in lineup from available pool', async () => {
      const user = userEvent.setup();
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          lineup={[mockDrivers[0], null]}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      // Verify Max is shown in the card (part of lineup)
      expect(await screen.findByText('Max Verstappen')).toBeInTheDocument();

      // Open selection sheet
      const addButtons = screen.getAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      // Only Lewis should be available in the pool (Max is already in lineup)
      await waitFor(() => {
        const listItems = screen.getAllByTestId('driver-list-item');
        expect(listItems).toHaveLength(1);
      });

      // Check within the list items that only Lewis is present
      const listItems = screen.getAllByTestId('driver-list-item');
      expect(within(listItems[0]).getByText('Lewis Hamilton')).toBeInTheDocument();
    });
  });

  describe('Removing Items', () => {
    it('calls removeFromTeam with correct parameters and invalidates router', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockRemoveFromTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          lineup={initialDrivers}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={mockRemoveFromTeam}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const removeButton = await screen.findByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      await waitFor(() => {
        expect(mockRemoveFromTeam).toHaveBeenCalledWith(0);
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });

    it('displays empty card when lineup slot is null', async () => {
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          lineup={[null, null]}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      expect(addButtons).toHaveLength(2);
      expect(screen.queryByText('Max Verstappen')).not.toBeInTheDocument();
    });

    it('includes all drivers in pool when lineup is empty', async () => {
      const user = userEvent.setup();
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          lineup={[null, null]}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      // Both drivers should be available in the pool
      const listItems = screen.getAllByTestId('driver-list-item');
      expect(listItems).toHaveLength(2);
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('does not invalidate router when addToTeam fails', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={mockAddToTeam}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(addButtons[0]);

      const selectButton = within(screen.getByTestId('driver-list-item')).getByRole('button');
      await user.click(selectButton);

      await waitFor(() => {
        expect(mockAddToTeam).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to add item:', expect.any(Error));
      });

      expect(mockInvalidate).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('does not invalidate router when removeFromTeam fails', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockRemoveFromTeam = vi.fn().mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <LineupPicker<Driver>
          lineupSize={2}
          lineup={initialDrivers}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={mockRemoveFromTeam}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      const removeButton = await screen.findByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      await waitFor(() => {
        expect(mockRemoveFromTeam).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to remove item:', expect.any(Error));
      });

      expect(mockInvalidate).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Generic Type Support - Constructors', () => {
    const createMockConstructor = (overrides: Partial<Constructor> = {}): Constructor => ({
      id: 1,
      name: 'Red Bull Racing',
      fullName: 'Oracle Red Bull Racing',
      countryAbbreviation: 'AUT',
      ...overrides,
    });

    it('works with Constructor type', async () => {
      const mockConstructors = [
        createMockConstructor({ id: 1, name: 'Red Bull Racing' }),
        createMockConstructor({ id: 2, name: 'Mercedes' }),
      ];
      const mockFetchItems = vi
        .fn<() => Promise<Constructor[]>>()
        .mockResolvedValue(mockConstructors);

      render(
        <LineupPicker<Constructor>
          lineupSize={2}
          CardComponent={MockConstructorCard}
          ListItemComponent={MockConstructorListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Constructor"
          sheetDescription="Choose a constructor"
          loadingMessage="Loading Constructors..."
          errorPrefix="Failed to load constructors"
        />,
      );

      const cards = await screen.findAllByTestId('constructor-card');
      expect(cards).toHaveLength(2);
    });

    it('handles constructor selection correctly', async () => {
      const user = userEvent.setup();
      const mockConstructors = [createMockConstructor({ id: 1, name: 'Red Bull Racing' })];
      const mockFetchItems = vi
        .fn<() => Promise<Constructor[]>>()
        .mockResolvedValue(mockConstructors);
      const mockAddToTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <LineupPicker<Constructor>
          lineupSize={2}
          CardComponent={MockConstructorCard}
          ListItemComponent={MockConstructorListItem}
          fetchItems={mockFetchItems}
          addToTeam={mockAddToTeam}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Constructor"
          sheetDescription="Choose a constructor"
          loadingMessage="Loading Constructors..."
          errorPrefix="Failed to load constructors"
        />,
      );

      const addButtons = await screen.findAllByRole('button', { name: 'Add Constructor' });
      await user.click(addButtons[0]);

      const selectButton = within(screen.getByTestId('constructor-list-item')).getByRole('button');
      await user.click(selectButton);

      await waitFor(() => {
        expect(mockAddToTeam).toHaveBeenCalledWith(1, 0);
        expect(mockInvalidate).toHaveBeenCalled();
      });

      // Verify the sheet closes after selection
      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: 'Select Constructor' }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Custom Grid Layout', () => {
    it('applies custom grid className when provided', async () => {
      const mockDrivers = [createMockDriver({ id: 1 })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      const { container } = render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
          gridClassName="grid grid-cols-3 gap-2"
        />,
      );

      await screen.findAllByTestId('driver-card');

      const gridElement = container.querySelector('.grid-cols-3');
      expect(gridElement).toBeInTheDocument();
    });

    it('uses default grid className when not provided', async () => {
      const mockDrivers = [createMockDriver({ id: 1 })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      const { container } = render(
        <LineupPicker<Driver>
          lineupSize={2}
          CardComponent={MockDriverCard}
          ListItemComponent={MockDriverListItem}
          fetchItems={mockFetchItems}
          addToTeam={vi.fn()}
          removeFromTeam={vi.fn()}
          sheetTitle="Select Driver"
          sheetDescription="Choose a driver"
          loadingMessage="Loading Drivers..."
          errorPrefix="Failed to load drivers"
        />,
      );

      await screen.findAllByTestId('driver-card');

      const gridElement = container.querySelector('.grid-cols-1');
      expect(gridElement).toBeInTheDocument();
    });
  });
});
