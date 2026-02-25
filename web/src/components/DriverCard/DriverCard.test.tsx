import { createMockDriver } from '@/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DriverCard } from './DriverCard';

describe('DriverCard', () => {
  describe('No Driver Selected - Edit Mode', () => {
    it('displays "Add Driver" button when no driver is selected in edit mode', () => {
      render(
        <DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={false} />,
      );

      expect(screen.getByRole('button', { name: /add driver/i })).toBeInTheDocument();
    });

    it('calls onOpenPicker when "Add Driver" button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(
        <DriverCard
          driver={null}
          onOpenPicker={onOpenPicker}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add driver/i }));

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('does not display remove button when no driver is selected', () => {
      render(
        <DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={false} />,
      );

      expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
    });
  });

  describe('No Driver Selected - Read-Only Mode', () => {
    it('displays "Empty Slot" text when no driver is selected in read-only mode', () => {
      render(
        <DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={true} />,
      );

      expect(screen.getByText('Empty Slot')).toBeInTheDocument();
    });

    it('does not display "Add Driver" button in read-only mode', () => {
      render(
        <DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={true} />,
      );

      expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    });

    it('does not display remove button in read-only mode', () => {
      render(
        <DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={true} />,
      );

      expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
    });
  });

  describe('Driver Selected - Edit Mode', () => {
    const driver = createMockDriver({
      firstName: 'Carlos',
      lastName: 'Sainz',
      abbreviation: 'SAI',
    });

    it('displays driver full name when driver is selected', () => {
      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={false} />,
      );

      expect(screen.getByText('Carlos Sainz')).toBeInTheDocument();
    });

    it('does not display "Add Driver" button when driver is selected', () => {
      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={false} />,
      );

      expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    });

    it('displays formatted price when driver is selected', () => {
      const driverWithPrice = createMockDriver({ price: 18_600_000 });
      render(
        <DriverCard
          driver={driverWithPrice}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      expect(screen.getByText('$18.6M')).toBeInTheDocument();
    });

    it('displays remove button with accessible label in edit mode', () => {
      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={false} />,
      );

      expect(screen.getByRole('button', { name: /remove driver/i })).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={onRemove} readOnly={false} />,
      );

      await user.click(screen.getByRole('button', { name: /remove driver/i }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Driver Selected - Read-Only Mode', () => {
    const driver = createMockDriver({
      firstName: 'Carlos',
      lastName: 'Sainz',
      abbreviation: 'SAI',
    });

    it('displays driver full name in read-only mode', () => {
      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={true} />,
      );

      expect(screen.getByText('Carlos Sainz')).toBeInTheDocument();
    });

    it('does not display remove button in read-only mode', () => {
      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={true} />,
      );

      expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
    });

    it('does not display "Add Driver" button in read-only mode', () => {
      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} readOnly={true} />,
      );

      expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Interactions', () => {
    it('allows keyboard interaction with "Add Driver" button in edit mode', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(
        <DriverCard
          driver={null}
          onOpenPicker={onOpenPicker}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      const addButton = screen.getByRole('button', { name: /add driver/i });
      addButton.focus();
      await user.keyboard('{Enter}');

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('allows keyboard interaction with remove button in edit mode', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();
      const driver = createMockDriver({
        firstName: 'Max',
        lastName: 'Verstappen',
        abbreviation: 'VER',
      });

      render(
        <DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={onRemove} readOnly={false} />,
      );

      const removeButton = screen.getByRole('button', { name: /remove driver/i });
      removeButton.focus();
      await user.keyboard('{Enter}');

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
