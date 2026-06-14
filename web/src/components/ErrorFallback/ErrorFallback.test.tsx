import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorFallback } from './ErrorFallback';

describe('ErrorFallback', () => {
  it('displays error details when error is provided', () => {
    const error = new Error('Test error message');
    render(<ErrorFallback error={error} />);

    const details = screen.getByText('Error details');
    expect(details).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('does not display error details when error is null', () => {
    render(<ErrorFallback error={null} />);

    expect(screen.queryByText('Error details')).not.toBeInTheDocument();
  });

  it('does not render reset button when onReset is not provided', () => {
    render(<ErrorFallback error={null} />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('calls onReset when reset button is clicked', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(<ErrorFallback error={null} onReset={onReset} />);

    const resetButton = screen.getByRole('button', { name: /try again/i });
    await user.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('includes AlertCircle icon with aria-hidden', () => {
    const { container } = render(<ErrorFallback error={null} />);

    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });
});
