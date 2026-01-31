import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Constructor } from '@/contracts/Role';

import { ConstructorCard } from './ConstructorCard';

describe('ConstructorCard', () => {
  describe('Empty State (no constructor selected)', () => {
    it('displays "Add Constructor" button when no constructor is selected', () => {
      render(<ConstructorCard constructor={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.getByRole('button', { name: /add constructor/i })).toBeInTheDocument();
    });

    it('calls onOpenPicker when "Add Constructor" button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(<ConstructorCard constructor={null} onOpenPicker={onOpenPicker} onRemove={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /add constructor/i }));

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('does not display remove button when no constructor is selected', () => {
      render(<ConstructorCard constructor={null} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /remove constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('Filled State (constructor selected)', () => {
    const constructor: Constructor = {
      id: 1,
      name: 'Ferrari',
      fullName: 'Scuderia Ferrari',
      countryAbbreviation: 'ITA',
    };

    it('displays constructor name when constructor is selected', () => {
      render(<ConstructorCard constructor={constructor} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.getByText('Ferrari')).toBeInTheDocument();
    });

    it('does not display "Add Constructor" button when constructor is selected', () => {
      render(<ConstructorCard constructor={constructor} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });

    it('displays remove button with accessible label', () => {
      render(<ConstructorCard constructor={constructor} onOpenPicker={vi.fn()} onRemove={vi.fn()} />);

      expect(screen.getByRole('button', { name: /remove constructor/i })).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(<ConstructorCard constructor={constructor} onOpenPicker={vi.fn()} onRemove={onRemove} />);

      await user.click(screen.getByRole('button', { name: /remove constructor/i }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Interactions', () => {
    it('allows keyboard interaction with "Add Constructor" button', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(<ConstructorCard constructor={null} onOpenPicker={onOpenPicker} onRemove={vi.fn()} />);

      const addButton = screen.getByRole('button', { name: /add constructor/i });
      addButton.focus();
      await user.keyboard('{Enter}');

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('allows keyboard interaction with remove button', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();
      const constructor: Constructor = {
        id: 2,
        name: 'Red Bull Racing',
        fullName: 'Oracle Red Bull Racing',
        countryAbbreviation: 'AUT',
      };

      render(<ConstructorCard constructor={constructor} onOpenPicker={vi.fn()} onRemove={onRemove} />);

      const removeButton = screen.getByRole('button', { name: /remove constructor/i });
      removeButton.focus();
      await user.keyboard('{Enter}');

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
