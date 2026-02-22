import { createMockConstructor } from '@/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstructorListItem } from './ConstructorListItem';

describe('ConstructorListItem', () => {
  const constructor = createMockConstructor({
    name: 'Mercedes',
    fullName: 'Mercedes-AMG Petronas F1 Team',
    abbreviation: 'MER',
    countryAbbreviation: 'DE',
    price: 3_000_000,
  });
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all constructor details', () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} />);

    expect(screen.getByText('MER')).toBeInTheDocument();
    expect(screen.getByText('Mercedes')).toBeInTheDocument();
    expect(screen.getByText('DE')).toBeInTheDocument();
    expect(screen.getByText('$3.0M')).toBeInTheDocument();
    expect(screen.getByText('-- pts')).toBeInTheDocument();
  });

  it('should call onSelect when add button is clicked', async () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add constructor/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('should dim the item and not call onSelect when disabled', async () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} disabled />);

    expect(screen.getByRole('listitem')).toHaveClass('opacity-40');

    const addConstructorButton = screen.getByRole('button', { name: /add constructor/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});
