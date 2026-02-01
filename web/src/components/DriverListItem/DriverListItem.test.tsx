import type { Driver } from '@/contracts/Role';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DriverListItem } from './DriverListItem';

describe('DriverListItem', () => {
  const driver: Driver = {
    id: 1,
    firstName: 'Carlos',
    lastName: 'Sainz',
    countryAbbreviation: 'ESP',
  };
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display the drivers full name', () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    expect(screen.getByText('Carlos Sainz')).toBeInTheDocument();
  });

  it('should render button to select driver', () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    const addDriverButton = screen.getByRole('button', { name: /add driver/i });
    expect(addDriverButton).toBeInTheDocument();
  });

  it('should call onSelect when add button is clicked', async () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add driver/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });
});
