import { createMockDriver } from '@/tests/test-utils/mockFactories';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DriverListItem } from './DriverListItem';

describe('DriverListItem', () => {
  const driver = createMockDriver({
    firstName: 'Carlos',
    lastName: 'Sainz',
    abbreviation: 'SAI',
    countryAbbreviation: 'ESP',
    price: 18_600_000,
  });
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all driver details', () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    expect(screen.getByText('SAI')).toBeInTheDocument();
    expect(screen.getByText('Carlos Sainz')).toBeInTheDocument();
    expect(screen.getByText('ESP')).toBeInTheDocument();
    expect(screen.getByText('$18.6M')).toBeInTheDocument();
    expect(screen.getByText('-- pts')).toBeInTheDocument();
  });

  it('should call onSelect when add button is clicked', async () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    const addDriverButton = screen.getByRole('button', { name: /add driver/i });
    await userEvent.click(addDriverButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('should dim the item and not call onSelect when disabled', async () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} disabled />);

    expect(screen.getByRole('listitem')).toHaveClass('opacity-40');

    const addDriverButton = screen.getByRole('button', { name: /add driver/i });
    await userEvent.click(addDriverButton);

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});
