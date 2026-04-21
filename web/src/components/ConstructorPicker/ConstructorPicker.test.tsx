import type { Constructor } from '@/contracts/Role';
import type { TeamConstructor } from '@/contracts/Team';
import { createMockConstructor, createMockConstructorList } from '@/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstructorPicker } from './ConstructorPicker';

// Mock useLineupPicker hook
const mockUseLineupPicker = vi.fn();
vi.mock('@/hooks/useLineupPicker', () => ({
  useLineupPicker: (...args: unknown[]) => mockUseLineupPicker(...args),
}));

// Mock data - will be set in beforeEach or individual tests
let mockDisplayLineup: (Constructor | null)[];
let mockPool: Constructor[];
let mockSelectedPosition: number | null;
let mockIsPending: boolean;
let mockError: string | null;

const mockConstructors: Constructor[] = createMockConstructorList([
  { name: 'McLaren', fullName: 'McLaren F1 Team', abbreviation: 'MCL', countryAbbreviation: 'GBR' },
  {
    name: 'Ferrari',
    fullName: 'Scuderia Ferrari',
    abbreviation: 'FER',
    countryAbbreviation: 'ITA',
  },
  {
    name: 'Red Bull Racing',
    fullName: 'Oracle Red Bull Racing',
    abbreviation: 'RBR',
    countryAbbreviation: 'AUT',
  },
  {
    name: 'Mercedes',
    fullName: 'Mercedes-AMG Petronas',
    abbreviation: 'MER',
    countryAbbreviation: 'GER',
  },
  {
    name: 'Aston Martin',
    fullName: 'Aston Martin Aramco',
    abbreviation: 'AMR',
    countryAbbreviation: 'GBR',
  },
]);

// Helper to convert Constructor to TeamConstructor
const toTeamConstructor = (constructor: Constructor, slotPosition: number): TeamConstructor => ({
  ...constructor,
  slotPosition,
});

describe('ConstructorPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default state: empty lineup, all constructors in pool, picker closed
    mockDisplayLineup = [null, null];
    mockPool = mockConstructors;
    mockSelectedPosition = null;
    mockIsPending = false;
    mockError = null;

    mockUseLineupPicker.mockImplementation(() => ({
      displayLineup: mockDisplayLineup,
      pool: mockPool,
      selectedPosition: mockSelectedPosition,
      isPending: mockIsPending,
      error: mockError,
      openPicker: vi.fn(),
      closePicker: vi.fn(),
      handleAdd: vi.fn(),
      handleRemove: vi.fn(),
    }));
  });

  describe('Lineup Rendering', () => {
    it('renders 2 empty constructor slots by default', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(2);
    });

    it('displays existing constructors in correct positions', () => {
      const teamConstructors: TeamConstructor[] = [toTeamConstructor(mockConstructors[0], 0)];

      mockDisplayLineup = [mockConstructors[0], null];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();

      // One filled slot, one empty
      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(1);
    });

    it('displays all constructors when lineup is full', () => {
      const teamConstructors: TeamConstructor[] = [
        toTeamConstructor(mockConstructors[0], 0),
        toTeamConstructor(mockConstructors[1], 1),
      ];

      mockDisplayLineup = [mockConstructors[0], mockConstructors[1]];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();

      // No "Add Constructor" buttons when all slots are filled
      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('Picker Sheet', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // Picker is open
    });

    it('displays all available constructors from pool', () => {
      mockPool = mockConstructors; // All constructors available

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
      expect(screen.getByText('Red Bull Racing')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();
      expect(screen.getByText('Aston Martin')).toBeInTheDocument();
    });

    it('only displays constructors not in current lineup', () => {
      mockDisplayLineup = [mockConstructors[0], null];
      mockPool = [
        mockConstructors[1],
        mockConstructors[2],
        mockConstructors[3],
        mockConstructors[4],
      ];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={[toTeamConstructor(mockConstructors[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Get the list element (pool) within the sheet
      const poolList = screen.getByRole('list');

      // McLaren should not appear in the pool (already in lineup)
      expect(poolList.textContent).not.toContain('McLaren');

      // Other constructors should appear in the pool
      expect(poolList.textContent).toContain('Ferrari');
      expect(poolList.textContent).toContain('Red Bull Racing');
      expect(poolList.textContent).toContain('Mercedes');
      expect(poolList.textContent).toContain('Aston Martin');
    });

    it('does not display sheet when picker is closed', () => {
      mockSelectedPosition = null;

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
    });

    it('keeps sheet open when operation is pending', () => {
      mockSelectedPosition = 0;
      mockIsPending = true;

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Sheet should remain open during pending operations
      expect(screen.getByText('Select Constructor')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message above grid when error occurs', () => {
      mockError = 'Failed to add constructor. Please try again.';

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to add constructor. Please try again.');
    });

    it('displays error regardless of picker state', () => {
      mockError = 'Failed to add constructor. Please try again.';
      mockSelectedPosition = null; // Picker closed

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Error should still be visible even when picker is closed
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to add constructor. Please try again.');
    });

    it('does not display error when no error exists', () => {
      mockError = null;

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML with proper roles', () => {
      mockSelectedPosition = 0;

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Sheet should have dialog role
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // List of constructors should use list/listitem roles
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('provides descriptive button labels', async () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Empty slot buttons should be clear
      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('provides aria-label for remove buttons', () => {
      mockDisplayLineup = [mockConstructors[0], null, null, null];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={[toTeamConstructor(mockConstructors[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove constructor/i });
      expect(removeButton).toHaveAccessibleName('Remove constructor');
    });
  });

  describe('Duplicate Constructors', () => {
    it('passes maxDuplicates: 2 to useLineupPicker', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(mockUseLineupPicker).toHaveBeenCalledWith(
        expect.objectContaining({ maxDuplicates: 2 }),
      );
    });
  });

  describe('Read-Only Mode', () => {
    it('does not render picker sheet when readOnly is true', () => {
      mockSelectedPosition = 0; // Even if picker would be "open"

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      // Sheet should not be rendered
      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays constructor lineup in read-only mode', () => {
      const teamConstructors: TeamConstructor[] = [
        toTeamConstructor(mockConstructors[0], 0),
        toTeamConstructor(mockConstructors[1], 1),
      ];

      mockDisplayLineup = [mockConstructors[0], mockConstructors[1], null, null];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      // Constructors should still be displayed
      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
    });

    it('displays errors in read-only mode', () => {
      mockError = 'Failed to load team data.';

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to load team data.');
    });

    it('does not render picker sheet when readOnly is false and picker is closed', () => {
      mockSelectedPosition = null;

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      // Sheet should not be rendered when picker is closed
      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
    });
  });

  describe('Section Header', () => {
    it('renders "Constructors" section header', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('Constructors')).toBeInTheDocument();
    });

    it('shows filled count in section header', () => {
      mockDisplayLineup = [mockConstructors[0], mockConstructors[1]];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
  });

  describe('Budget Filtering', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // picker open
    });

    it('disables constructors that exceed remaining budget', () => {
      mockPool = [createMockConstructor({ id: 99, price: 28_000_000 })];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={10_000_000}
        />,
      );

      expect(screen.getByRole('button', { name: /add constructor/i })).toBeDisabled();
    });

    it('does not disable constructors within remaining budget', () => {
      mockPool = [createMockConstructor({ id: 98, price: 5_000_000 })];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={10_000_000}
        />,
      );

      expect(screen.getByRole('button', { name: /add constructor/i })).not.toBeDisabled();
    });
  });
});
