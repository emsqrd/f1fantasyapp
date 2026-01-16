import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('displays the error message', () => {
    render(<ErrorState message="Something went wrong loading data" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong loading data')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<ErrorState message="Test error" />);

    const errorContainer = screen.getByRole('alert');
    expect(errorContainer).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Test error" onRetry={onRetry} />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState message="Test error" />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorState message="Test error" onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('includes AlertCircle icon with aria-hidden', () => {
    const { container } = render(<ErrorState message="Test error" />);

    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('displays different error messages correctly', () => {
    const { rerender } = render(<ErrorState message="First error" />);
    expect(screen.getByText('First error')).toBeInTheDocument();

    rerender(<ErrorState message="Second error" />);
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });
});
