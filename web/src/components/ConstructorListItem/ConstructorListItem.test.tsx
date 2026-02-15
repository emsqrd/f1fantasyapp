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
  });
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onSelect when add button is clicked', async () => {
    render(<ConstructorListItem constructor={constructor} onSelect={mockOnSelect} />);

    const addConstructorButton = screen.getByRole('button', { name: /add constructor/i });
    await userEvent.click(addConstructorButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });
});
