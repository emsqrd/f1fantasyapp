import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AddRoleCardContent } from './AddRoleCardContent';

describe('AddRoleCardContent', () => {
  it('should display Add Constructor when role is Constructor', () => {
    render(<AddRoleCardContent role="Constructor" onOpenSheet={vi.fn()} />);

    expect(screen.getByRole('button', { name: /add constructor/i })).toBeInTheDocument();
  });

  it('should call onOpenSheet when button is clicked', async () => {
    const user = userEvent.setup();
    const mockCallback = vi.fn();

    render(<AddRoleCardContent role="Constructor" onOpenSheet={mockCallback} />);

    const button = screen.getByRole('button', { name: /add constructor/i });
    await user.click(button);

    expect(mockCallback).toHaveBeenCalledOnce();
  });
});
