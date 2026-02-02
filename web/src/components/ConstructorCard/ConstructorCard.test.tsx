import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Constructor } from '@/contracts/Role';

import { ConstructorCard } from './ConstructorCard';

describe('ConstructorCard', () => {
  describe('No Constructor Selected - Edit Mode', () => {
    it('displays "Add Constructor" button when no constructor is selected in edit mode', () => {
      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      expect(screen.getByRole('button', { name: /add constructor/i })).toBeInTheDocument();
    });

    it('calls onOpenPicker when "Add Constructor" button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={onOpenPicker}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add constructor/i }));

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('does not display remove button when no constructor is selected', () => {
      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      expect(screen.queryByRole('button', { name: /remove constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('No Constructor Selected - Read-Only Mode', () => {
    it('displays "Empty Slot" text when no constructor is selected in read-only mode', () => {
      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={true}
        />,
      );

      expect(screen.getByText('Empty Slot')).toBeInTheDocument();
    });

    it('does not display "Add Constructor" button in read-only mode', () => {
      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={true}
        />,
      );

      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });

    it('does not display remove button in read-only mode', () => {
      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={true}
        />,
      );

      expect(screen.queryByRole('button', { name: /remove constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('Constructor Selected - Edit Mode', () => {
    const constructor: Constructor = {
      id: 1,
      name: 'Ferrari',
      fullName: 'Scuderia Ferrari',
      countryAbbreviation: 'ITA',
    };

    it('displays constructor name when constructor is selected', () => {
      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      expect(screen.getByText('Ferrari')).toBeInTheDocument();
    });

    it('does not display "Add Constructor" button when constructor is selected', () => {
      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });

    it('displays remove button with accessible label in edit mode', () => {
      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      expect(screen.getByRole('button', { name: /remove constructor/i })).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={onRemove}
          readOnly={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /remove constructor/i }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Constructor Selected - Read-Only Mode', () => {
    const constructor: Constructor = {
      id: 1,
      name: 'Ferrari',
      fullName: 'Scuderia Ferrari',
      countryAbbreviation: 'ITA',
    };

    it('displays constructor name in read-only mode', () => {
      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={true}
        />,
      );

      expect(screen.getByText('Ferrari')).toBeInTheDocument();
    });

    it('does not display remove button in read-only mode', () => {
      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={true}
        />,
      );

      expect(screen.queryByRole('button', { name: /remove constructor/i })).not.toBeInTheDocument();
    });

    it('does not display "Add Constructor" button in read-only mode', () => {
      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={vi.fn()}
          readOnly={true}
        />,
      );

      expect(screen.queryByRole('button', { name: /add constructor/i })).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Interactions', () => {
    it('allows keyboard interaction with "Add Constructor" button in edit mode', async () => {
      const user = userEvent.setup();
      const onOpenPicker = vi.fn();

      render(
        <ConstructorCard
          constructor={null}
          onOpenPicker={onOpenPicker}
          onRemove={vi.fn()}
          readOnly={false}
        />,
      );

      const addButton = screen.getByRole('button', { name: /add constructor/i });
      addButton.focus();
      await user.keyboard('{Enter}');

      expect(onOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('allows keyboard interaction with remove button in edit mode', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();
      const constructor: Constructor = {
        id: 2,
        name: 'Red Bull Racing',
        fullName: 'Oracle Red Bull Racing',
        countryAbbreviation: 'AUT',
      };

      render(
        <ConstructorCard
          constructor={constructor}
          onOpenPicker={vi.fn()}
          onRemove={onRemove}
          readOnly={false}
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove constructor/i });
      removeButton.focus();
      await user.keyboard('{Enter}');

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
