import type { Driver } from '@/contracts/Role';
import type { TeamDriver } from '@/contracts/Team';
import { createMockDriverList } from '@/tests/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DriverPicker } from './DriverPicker';

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

const mockDrivers: Driver[] = createMockDriverList([
  { firstName: 'Oscar', lastName: 'Piastri', abbreviation: 'PIA', countryAbbreviation: 'AUS' },
  { firstName: 'Lando', lastName: 'Norris', abbreviation: 'NOR', countryAbbreviation: 'GBR' },
  { firstName: 'Charles', lastName: 'Leclerc', abbreviation: 'LEC', countryAbbreviation: 'MON' },
  { firstName: 'Max', lastName: 'Verstappen', abbreviation: 'VER', countryAbbreviation: 'NED' },
  { firstName: 'Lewis', lastName: 'Hamilton', abbreviation: 'HAM', countryAbbreviation: 'GBR' },
]);

const toTeamDriver = (driver: Driver, slotPosition: number, isCaptain = false): TeamDriver => ({
  ...driver,
  slotPosition,
  isCaptain,
});

describe('DriverPicker', () => {
  describe('Lineup Rendering', () => {
    it('renders 5 empty driver slots by default', () => {
      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(5);
    });

    it('displays existing drivers in correct positions', () => {
      const teamDrivers: TeamDriver[] = [
        toTeamDriver(mockDrivers[0], 0),
        toTeamDriver(mockDrivers[1], 1),
      ];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={teamDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();

      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons).toHaveLength(3);
    });

    it('hides add buttons when lineup is full', () => {
      const teamDrivers: TeamDriver[] = mockDrivers.map((d, i) => toTeamDriver(d, i));

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={teamDrivers}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    });
  });

  describe('Picker Sheet', () => {
    it('does not display sheet when picker is closed', () => {
      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides descriptive button labels', () => {
      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={false} remainingBudget={100_000_000} />,
      );

      const addButtons = screen.getAllByRole('button', { name: /add driver/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('provides aria-label for remove buttons', () => {
      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove driver/i });
      expect(removeButton).toHaveAccessibleName('Remove driver');
    });
  });

  describe('Read-Only Mode', () => {
    it('does not render picker sheet when readOnly is true', () => {
      render(
        <DriverPicker activeDrivers={mockDrivers} readOnly={true} remainingBudget={100_000_000} />,
      );

      expect(screen.queryByText('Select Driver')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays driver lineup in read-only mode', () => {
      const teamDrivers: TeamDriver[] = [
        toTeamDriver(mockDrivers[0], 0),
        toTeamDriver(mockDrivers[1], 1),
      ];

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={teamDrivers}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
    });

    it('hides remove buttons in read-only mode', () => {
      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={true}
          remainingBudget={100_000_000}
        />,
      );

      expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
    });
  });

  describe('Captain', () => {
    it('shows active captain button for the driver matching captainDriverId', () => {
      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={mockDrivers[0].id}
          onSetCaptain={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /captain.*active/i })).toBeInTheDocument();
    });

    it('calls onSetCaptain with driver id when Set as captain is clicked', async () => {
      const user = userEvent.setup();
      const onSetCaptain = vi.fn();

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0)]}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={null}
          onSetCaptain={onSetCaptain}
        />,
      );

      await user.click(screen.getByRole('button', { name: /set.*captain/i }));

      expect(onSetCaptain).toHaveBeenCalledWith(mockDrivers[0].id);
    });

    it('calls onSetCaptain with null when active captain button is clicked', async () => {
      const user = userEvent.setup();
      const onSetCaptain = vi.fn();

      render(
        <DriverPicker
          activeDrivers={mockDrivers}
          teamDrivers={[toTeamDriver(mockDrivers[0], 0, true)]}
          readOnly={false}
          remainingBudget={100_000_000}
          captainDriverId={mockDrivers[0].id}
          onSetCaptain={onSetCaptain}
        />,
      );

      await user.click(screen.getByRole('button', { name: /captain.*active/i }));

      expect(onSetCaptain).toHaveBeenCalledWith(null);
    });
  });
});
