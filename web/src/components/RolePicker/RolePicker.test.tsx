import type { Constructor, Driver } from '@/contracts/Role';
import { createMockDriver } from '@/test-utils';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RolePicker } from './RolePicker';

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

describe('RolePicker', () => {
  describe('Loading State', () => {
    it('displays loading message while fetching items', () => {
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>(() => new Promise(() => {})); // Never resolves

      render(
        <RolePicker<Driver>
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
        <RolePicker<Driver>
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
        <RolePicker<Driver>
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
        <RolePicker<Driver>
          lineupSize={3}
          initialItems={initialDrivers}
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
        <RolePicker<Driver>
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
        <RolePicker<Driver>
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
        <RolePicker<Driver>
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
        <RolePicker<Driver>
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
        expect(screen.queryByRole('heading', { name: 'Select Driver' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Adding Items', () => {
    it('calls addToTeam with correct parameters when selecting item', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <RolePicker<Driver>
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
      });
    });

    it('updates card to show selected item', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <RolePicker<Driver>
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
        expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      });
    });

    it('removes selected item from pool in selection sheet', async () => {
      const user = userEvent.setup();
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <RolePicker<Driver>
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

      // Select first driver
      const firstAddButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(firstAddButtons[0]);

      const selectMaxButton = within(screen.getAllByTestId('driver-list-item')[0]).getByRole(
        'button',
      );
      await user.click(selectMaxButton);

      // Wait for the sheet to close and card to update
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Select Driver' })).not.toBeInTheDocument();
      });

      // Verify Max is shown on the card (optimistic update)
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();

      // Open sheet again for second slot
      const secondAddButtons = await screen.findAllByRole('button', { name: 'Add Driver' });
      await user.click(secondAddButtons[0]);

      // Max should not be in the pool anymore, only Lewis should be available
      await waitFor(() => {
        const listItems = screen.getAllByTestId('driver-list-item');
        expect(listItems).toHaveLength(1);
      });
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    });
  });

  describe('Removing Items', () => {
    it('calls removeFromTeam with correct parameters', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockRemoveFromTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <RolePicker<Driver>
          lineupSize={2}
          initialItems={initialDrivers}
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
      });
    });

    it('clears card after removing item', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockRemoveFromTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <RolePicker<Driver>
          lineupSize={2}
          initialItems={initialDrivers}
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

      expect(await screen.findByText('Max Verstappen')).toBeInTheDocument();

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('Max Verstappen')).not.toBeInTheDocument();
      });
    });

    it('returns removed item to pool', async () => {
      const user = userEvent.setup();
      const mockDrivers = [
        createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' }),
        createMockDriver({ id: 2, firstName: 'Lewis', lastName: 'Hamilton' }),
      ];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockRemoveFromTeam = vi.fn().mockResolvedValue(undefined);

      render(
        <RolePicker<Driver>
          lineupSize={2}
          initialItems={initialDrivers}
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

      await waitFor(async () => {
        const addButton = screen.getAllByRole('button', { name: 'Add Driver' })[0];
        await user.click(addButton);
      });

      // Both drivers should now be in the pool
      const listItems = screen.getAllByTestId('driver-list-item');
      expect(listItems).toHaveLength(2);
    });
  });

  describe('Error Handling and Rollback', () => {
    it('rolls back add operation when addToTeam fails', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockAddToTeam = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <RolePicker<Driver>
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

      // Wait for the error to be handled and rollback to complete
      await waitFor(() => {
        expect(mockAddToTeam).toHaveBeenCalled();
      });

      // Wait for rollback - card should remain empty after rollback
      await waitFor(() => {
        expect(screen.queryByText('Max Verstappen')).not.toBeInTheDocument();
      });
    });

    it('rolls back remove operation when removeFromTeam fails', async () => {
      const user = userEvent.setup();
      const mockDrivers = [createMockDriver({ id: 1, firstName: 'Max', lastName: 'Verstappen' })];
      const initialDrivers = [mockDrivers[0]];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);
      const mockRemoveFromTeam = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <RolePicker<Driver>
          lineupSize={2}
          initialItems={initialDrivers}
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
      });

      // Driver should remain in card after rollback
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    });
  });

  describe('Generic Type Support - Constructors', () => {
    const createMockConstructor = (overrides: Partial<Constructor> = {}): Constructor => ({
      type: 'constructor',
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
        <RolePicker<Constructor>
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
        <RolePicker<Constructor>
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
      });
      expect(screen.getByText('Red Bull Racing')).toBeInTheDocument();
    });
  });

  describe('Custom Grid Layout', () => {
    it('applies custom grid className when provided', async () => {
      const mockDrivers = [createMockDriver({ id: 1 })];
      const mockFetchItems = vi.fn<() => Promise<Driver[]>>().mockResolvedValue(mockDrivers);

      const { container } = render(
        <RolePicker<Driver>
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
        <RolePicker<Driver>
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
