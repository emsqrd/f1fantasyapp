import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstructorPicker } from './ConstructorPicker';

// Mock TanStack Router
const mockInvalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: mockInvalidate,
  }),
}));

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
    mockInvalidate.mockResolvedValue(undefined);
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

    it('calls add service and invalidates router when constructor is selected', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);

      await screen.findByText('Select Constructor');
      await selectConstructorFromPool(user, 'Ferrari');

      await waitFor(() => {
        expect(mockAddConstructorToTeam).toHaveBeenCalledWith(1, 0);
        expect(mockInvalidate).toHaveBeenCalled();
      });

      // Verify sheet closes after selection
      await waitFor(() => {
        expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      });
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
    it('calls remove service and invalidates router when constructor is removed', async () => {
      const user = userEvent.setup();
      const currentConstructors = [mockConstructors[0], null]; // Ferrari in first slot
      render(<ConstructorPicker currentConstructors={currentConstructors} />);

      // Verify constructor is displayed
      expect(await screen.findByRole('heading', { name: 'Ferrari' })).toBeInTheDocument();

      // Remove the constructor using the remove button
      await user.click(screen.getByRole('button', { name: /remove role/i }));

      await waitFor(() => {
        expect(mockRemoveConstructorFromTeam).toHaveBeenCalledWith(0);
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });

  describe('Pool Management', () => {
    it('excludes constructors in lineup from available pool', async () => {
      const user = userEvent.setup();
      const currentConstructors = [mockConstructors[0], null]; // Ferrari in first slot
      render(<ConstructorPicker currentConstructors={currentConstructors} />);

      // Verify constructor is displayed in lineup
      expect(await screen.findByRole('heading', { name: 'Ferrari' })).toBeInTheDocument();

      // Open sheet for second slot
      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Constructor');

      // Pool should have only 3 constructors (Ferrari is already in lineup)
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();
      expect(screen.getByText('Red Bull')).toBeInTheDocument();
      // Verify Ferrari is not in the pool
      expect(within(screen.getByRole('list')).queryByText('Ferrari')).not.toBeInTheDocument();
    });

    it('includes all constructors in pool when lineup is empty', async () => {
      const user = userEvent.setup();
      render(<ConstructorPicker />);

      const addButtons = await screen.findAllByRole('button', { name: /add constructor/i });
      await user.click(addButtons[0]);
      await screen.findByText('Select Constructor');

      // All 4 constructors should be available in the pool
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();
      expect(screen.getByText('Red Bull')).toBeInTheDocument();
    });
  });

  describe('Multi-Constructor Workflow', () => {
    it('displays multiple constructors when provided via currentConstructors prop', async () => {
      const currentConstructors = [
        mockConstructors[0], // Ferrari
        mockConstructors[1], // McLaren
      ];
      render(<ConstructorPicker currentConstructors={currentConstructors} />);

      // Verify both constructors are displayed (shown as headings in filled cards)
      expect(await screen.findByRole('heading', { name: 'Ferrari' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'McLaren' })).toBeInTheDocument();
      // 0 empty slots remaining (both slots filled)
      expect(screen.queryByRole('button', { name: /add constructor/i })).toBeNull();
    });
  });
});
