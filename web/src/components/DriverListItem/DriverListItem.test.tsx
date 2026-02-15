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

  it('should call onSelect when add button is clicked', async () => {
    render(<DriverListItem driver={driver} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add driver/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });
});
