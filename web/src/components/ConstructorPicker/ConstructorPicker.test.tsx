import type { Constructor } from '@/contracts/Role';
import type { TeamConstructor } from '@/contracts/Team';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstructorPicker } from './ConstructorPicker';

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
let mockDisplayLineup: (Constructor | null)[];
let mockPool: Constructor[];
let mockSelectedPosition: number | null;
let mockIsPending: boolean;
let mockError: string | null;

const mockConstructors: Constructor[] = [
  { id: 1, name: 'McLaren', fullName: 'McLaren F1 Team', countryAbbreviation: 'GBR' },
  { id: 2, name: 'Ferrari', fullName: 'Scuderia Ferrari', countryAbbreviation: 'ITA' },
  {
    id: 3,
    name: 'Red Bull Racing',
    fullName: 'Oracle Red Bull Racing',
    countryAbbreviation: 'AUT',
  },
  { id: 4, name: 'Mercedes', fullName: 'Mercedes-AMG Petronas', countryAbbreviation: 'GER' },
  { id: 5, name: 'Aston Martin', fullName: 'Aston Martin Aramco', countryAbbreviation: 'GBR' },
];

// Helper to convert Constructor to TeamConstructor
const toTeamConstructor = (constructor: Constructor, slotPosition: number): TeamConstructor => ({
  ...constructor,
  slotPosition,
});

describe('ConstructorPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default state: empty lineup, all constructors in pool, picker closed
    mockDisplayLineup = [null, null, null, null];
    mockPool = mockConstructors;
    mockSelectedPosition = null;
    mockIsPending = false;
    mockError = null;
  });

  describe('Lineup Rendering', () => {
    it('renders 4 empty constructor slots by default', () => {
      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(4);
    });

    it('displays existing constructors in correct positions', () => {
      const teamConstructors: TeamConstructor[] = [
        toTeamConstructor(mockConstructors[0], 0),
        toTeamConstructor(mockConstructors[1], 1),
      ];

      mockDisplayLineup = [mockConstructors[0], mockConstructors[1], null, null];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();

      // Two filled slots, two empty
      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(2);
    });

    it('displays all constructors when lineup is full', () => {
      const teamConstructors: TeamConstructor[] = [
        toTeamConstructor(mockConstructors[0], 0),
        toTeamConstructor(mockConstructors[1], 1),
        toTeamConstructor(mockConstructors[2], 2),
        toTeamConstructor(mockConstructors[3], 3),
      ];

      mockDisplayLineup = [
        mockConstructors[0],
        mockConstructors[1],
        mockConstructors[2],
        mockConstructors[3],
      ];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
      expect(screen.getByText('Red Bull Racing')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();

      // No "Add Constructor" buttons when all slots are filled
      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('Picker Sheet', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // Picker is open
    });

    it('displays sheet with title and description when picker is open', () => {
      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      expect(screen.getByText('Select Constructor')).toBeInTheDocument();
      expect(
        screen.getByText('Choose a constructor from the list below to add to your team.'),
      ).toBeInTheDocument();
    });

    it('displays all available constructors from pool', () => {
      mockPool = mockConstructors; // All constructors available

      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
      expect(screen.getByText('Red Bull Racing')).toBeInTheDocument();
      expect(screen.getByText('Mercedes')).toBeInTheDocument();
      expect(screen.getByText('Aston Martin')).toBeInTheDocument();
    });

    it('only displays constructors not in current lineup', () => {
      mockDisplayLineup = [mockConstructors[0], null, null, null];
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

      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
    });

    it('does not display sheet when operation is pending', () => {
      mockSelectedPosition = 0;
      mockIsPending = true;

      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSelectedPosition = 0; // Picker must be open to show errors
    });

    it('displays error message in picker when error occurs', () => {
      mockError = 'Failed to add constructor. Please try again.';

      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Failed to add constructor. Please try again.');
    });

    it('does not display error when no error exists', () => {
      mockError = null;

      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML with proper roles', () => {
      mockSelectedPosition = 0;

      render(<ConstructorPicker activeConstructors={mockConstructors} />);

      // Sheet should have dialog role
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // List of constructors should use list/listitem roles
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('provides descriptive button labels', async () => {
      render(<ConstructorPicker activeConstructors={mockConstructors} />);

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
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove constructor/i });
      expect(removeButton).toHaveAccessibleName('Remove constructor');
    });
  });
});
