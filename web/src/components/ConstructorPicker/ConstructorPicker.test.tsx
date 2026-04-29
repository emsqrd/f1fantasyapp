import type { Constructor } from '@/contracts/Role';
import type { TeamConstructor } from '@/contracts/Team';
import { createMockConstructorList } from '@/tests/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConstructorPicker } from './ConstructorPicker';

vi.mock('@/hooks/useLineupPicker', () => ({
  useLineupPicker: () => ({
    pool: [],
    selectedPosition: null,
    isPending: false,
    error: null,
    openPicker: vi.fn(),
    closePicker: vi.fn(),
    handleAdd: vi.fn(),
    handleRemove: vi.fn(),
  }),
}));

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

const toTeamConstructor = (constructor: Constructor, slotPosition: number): TeamConstructor => ({
  ...constructor,
  slotPosition,
});

describe('ConstructorPicker', () => {
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

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();

      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons).toHaveLength(1);
    });

    it('hides add buttons when lineup is full', () => {
      const teamConstructors: TeamConstructor[] = [
        toTeamConstructor(mockConstructors[0], 0),
        toTeamConstructor(mockConstructors[1], 1),
      ];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('Picker Sheet', () => {
    it('does not display sheet when picker is closed', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides descriptive button labels', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      const addButtons = screen.getAllByRole('button', { name: /add constructor/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('provides aria-label for remove buttons', () => {
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

  describe('Read-Only Mode', () => {
    it('does not render picker sheet when readOnly is true', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByText('Select Constructor')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays constructor lineup in read-only mode', () => {
      const teamConstructors: TeamConstructor[] = [
        toTeamConstructor(mockConstructors[0], 0),
        toTeamConstructor(mockConstructors[1], 1),
      ];

      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={teamConstructors}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('McLaren')).toBeInTheDocument();
      expect(screen.getByText('Ferrari')).toBeInTheDocument();
    });

    it('hides remove buttons in read-only mode', () => {
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={[toTeamConstructor(mockConstructors[0], 0)]}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByRole('button', { name: /remove constructor/i })).not.toBeInTheDocument();
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
      render(
        <ConstructorPicker
          activeConstructors={mockConstructors}
          teamConstructors={[
            toTeamConstructor(mockConstructors[0], 0),
            toTeamConstructor(mockConstructors[1], 1),
          ]}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
  });
});
