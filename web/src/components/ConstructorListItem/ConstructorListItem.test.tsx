import type { Constructor } from '@/contracts/Role';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstructorListItem } from './ConstructorListItem';

describe('ConstructorListItem', () => {
  const constructor: Constructor = {
    id: 1,
    type: 'constructor',
    name: 'Mercedes',
    fullName: 'Mercedes-AMG Petronas F1 Team',
    countryAbbreviation: 'DE',
  };
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display the constructor name', () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} />);

    expect(screen.getByText('Mercedes')).toBeInTheDocument();
  });

  it('should render button to select constructor', () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add constructor/i });
    expect(addConstructorButton).toBeInTheDocument();
  });

  it('should call onSelect when add button is clicked', async () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add constructor/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });
});
