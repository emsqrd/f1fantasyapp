import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createMockDriver } from '@/test-utils/mockFactories';

import { DriverCard } from './DriverCard';

describe('DriverCard', () => {
  describe('Empty State (no driver selected)', () => {
    it('displays "Add Driver" button when no driver is selected', () => {
      render(<DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.getByRole('button', { name: /add driver/i })).toBeInTheDocument();
    });

    it('calls onOpenPicker when "Add Driver" button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(<DriverCard driver={null} onOpenPicker={onOpenPicker} onRemove={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /add driver/i }));

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('does not display remove button when no driver is selected', () => {
      render(<DriverCard driver={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /remove driver/i })).not.toBeInTheDocument();
    });
  });

  describe('Filled State (driver selected)', () => {
    const driver = createMockDriver({
      firstName: 'Carlos',
      lastName: 'Sainz',
    });

    it('displays driver full name when driver is selected', () => {
      render(<DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.getByText('Carlos Sainz')).toBeInTheDocument();
    });

    it('does not display "Add Driver" button when driver is selected', () => {
      render(<DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /add driver/i })).not.toBeInTheDocument();
    });

    it('displays remove button with accessible label', () => {
      render(<DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.getByRole('button', { name: /remove driver/i })).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(<DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={onRemove} />);

      await user.click(screen.getByRole('button', { name: /remove driver/i }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Interactions', () => {
    it('allows keyboard interaction with "Add Driver" button', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(<DriverCard driver={null} onOpenPicker={onOpenPicker} onRemove={vi.fn()} />);

      const addButton = screen.getByRole('button', { name: /add driver/i });
      addButton.focus();
      await user.keyboard('{Enter}');

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('allows keyboard interaction with remove button', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();
      const driver = createMockDriver({ firstName: 'Max', lastName: 'Verstappen' });

      render(<DriverCard driver={driver} onOpenPicker={vi.fn()} onRemove={onRemove} />);

      const removeButton = screen.getByRole('button', { name: /remove driver/i });
      removeButton.focus();
      await user.keyboard('{Enter}');

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
