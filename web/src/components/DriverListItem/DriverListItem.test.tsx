import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockDriver } from '@/test-utils/mockFactories';
import { DriverListItem } from './DriverListItem';

describe('DriverListItem', () => {
  const driver = createMockDriver({
    firstName: 'Carlos',
    lastName: 'Sainz',
    abbreviation: 'SAI',
    countryAbbreviation: 'ESP',
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
    expect(screen.getByText('$--.-M')).toBeInTheDocument();
    expect(screen.getByText('-- pts')).toBeInTheDocument();
  });

  it('should call onSelect when add button is clicked', async () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add driver/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });
});
