import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstructorPicker } from './ConstructorPicker';

// Mock the constructor service (external API call - appropriate to mock)
const mockGetActiveConstructors = vi.fn();
vi.mock('@/services/constructorService', () => ({
  getActiveConstructors: () => mockGetActiveConstructors(),
}));

// Mock the team service for persistence
const mockAddConstructorToTeam = vi.fn();
const mockRemoveConstructorFromTeam = vi.fn();
vi.mock('@/services/teamService', () => ({
  addConstructorToTeam: (...args: unknown[]) => mockAddConstructorToTeam(...args),
  removeConstructorFromTeam: (...args: unknown[]) => mockRemoveConstructorFromTeam(...args),
}));

const mockConstructors = [
  { id: 1, name: 'Ferrari', fullName: 'Scuderia Ferrari', countryAbbreviation: 'ITA' },
  { id: 2, name: 'McLaren', fullName: 'McLaren F1 Team', countryAbbreviation: 'GBR' },
  { id: 3, name: 'Mercedes', fullName: 'Mercedes-AMG Petronas', countryAbbreviation: 'GER' },
  { id: 4, name: 'Red Bull', fullName: 'Oracle Red Bull Racing', countryAbbreviation: 'AUT' },
];

// Helper to find and click a constructor's add button in the pool list within the sheet
async function selectConstructorFromPool(
  user: ReturnType<typeof userEvent.setup>,
  constructorName: string,
) {
  // Find the list item containing the constructor name, then click its add button
  const listItems = screen.getAllByRole('listitem');
  const targetItem = listItems.find((item) => item.textContent?.includes(constructorName));
  if (!targetItem) {
    throw new Error(`Could not find list item for constructor: ${constructorName}`);
  }
  const addButton = within(targetItem).getByRole('button', { name: /add constructor/i });
  await user.click(addButton);
}

describe('ConstructorPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveConstructors.mockResolvedValue(mockConstructors);
    mockAddConstructorToTeam.mockResolvedValue(undefined);
    mockRemoveConstructorFromTeam.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('displays loading indicator while fetching constructors', () => {
      // Keep promise pending to observe loading state
      mockGetActiveConstructors.mockReturnValue(new Promise(() => {}));

      render(<ConstructorPicker />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading Constructors...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when constructor fetch fails', async () => {
      mockGetActiveConstructors.mockRejectedValue(new Error('Network error'));

      render(<ConstructorPicker />);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to load active constructors',
      );
    });
  });

  describe('Slot Rendering', () => {
    it('renders default of 2 empty slots when loaded', async () => {
      render(<ConstructorPicker />);

      // Wait for loading to complete, then find "Add Constructor" buttons in slot cards
      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(2);
    });

    it('renders custom slot count when specified', async () => {
      render(<ConstructorPicker lineupSize={2} />);

      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(2);
    });
  });

  describe('Constructor Selection Flow', () => {
    it('opens selection sheet and displays available constructors when clicking add button', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);

      // Sheet should open with title and description
      expect(await screen.findByText('Select Constructor')).toBeInTheDocument();
      expect(
        screen.getByText('Choose a constructor from the list below to add to your team.'),
      ).toBeInTheDocument();

      // All 4 constructors should be available in the pool as list items
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();
      expect(screen.getByText('Red Bull')).toBeInTheDocument();
    });

    it('adds selected constructor to slot and closes sheet', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);

      await screen.findByText('Select Constructor');
      await selectConstructorFromPool(user, 'Ferrari');

      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });

      // Ferrari should now appear as a selected constructor (in heading)
      expect(screen.getByRole('heading', { name: 'Ferrari' })).toBeInTheDocument();
      // Should have 1 empty slot remaining
      expect(screen.getAllByRole('button', { name: /add constructor/i })).toHaveLength(1);
    });

    it('closes sheet without selecting when pressing escape', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);

      await screen.findByText('Select Constructor');
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });

      // All 2 slots should still be empty
      expect(screen.getAllByRole('button', { name: /add constructor/i })).toHaveLength(2);
    });
  });

  describe('Constructor Removal', () => {
    it('removes constructor from slot when remove button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      // Add a constructor first
      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Constructor');
      await selectConstructorFromPool(user, 'Ferrari');

      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });

      // Remove the constructor using the remove button
      await user.click(screen.getByRole('button', { name: /remove role/i }));

      // Constructor should be removed, all slots empty again
      expect(screen.queryByRole('heading', { name: 'Ferrari' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /add constructor/i })).toHaveLength(2);
    });
  });

  describe('Pool Management', () => {
    it('removes selected constructor from available pool', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      // Open sheet and add Ferrari
      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Constructor');
      expect(screen.getAllByRole('listitem')).toHaveLength(4);

      await selectConstructorFromPool(user, 'Ferrari');

      // Open sheet again for second slot
      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });

      const remainingAddButtons = screen.getAllByRole('button', { name: /add constructor/i });
      await user.click(remainingAddButtons[0]);
      await screen.findByText('Select Constructor');

      // Pool should now have only 3 constructors (Ferrari was removed)
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();
      expect(screen.getByText('Red Bull')).toBeInTheDocument();
    });

    it('returns removed constructor back to available pool', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      // Add and then remove a constructor
      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Constructor');
      await selectConstructorFromPool(user, 'Ferrari');

      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /remove role/i }));

      // Open sheet to check pool
      const allAddButtons = screen.getAllByRole('button', { name: /add constructor/i });
      await user.click(allAddButtons[0]);
      await screen.findByText('Select Constructor');

      // Ferrari should be back in the pool - all 4 constructors available
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
    });
  });

  describe('Multi-Constructor Workflow', () => {
    it('handles adding multiple constructors to different slots', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      // Add first constructor (Ferrari)
      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Constructor');
      await selectConstructorFromPool(user, 'Ferrari');

      // Add second constructor (McLaren)
      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });
      const remainingSlotButtons = screen.getAllByRole('button', { name: /add constructor/i });
      await user.click(remainingSlotButtons[0]);
      await screen.findByText('Select Constructor');
      await selectConstructorFromPool(user, 'McLaren');

      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });

      // Verify two constructors are selected (shown as headings in filled cards)
      expect(screen.getByRole('heading', { name: 'Ferrari' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'McLaren' })).toBeInTheDocument();
      // 0 empty slots remaining
      expect(screen.queryByRole('button', { name: /add constructor/i })).toBeNull();
    });
  });
});
