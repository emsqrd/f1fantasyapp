import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorFallback } from './ErrorFallback';

describe('ErrorFallback', () => {
  it('displays error message for page level', () => {
    render(<ErrorFallback error={null} level="page" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/please try refreshing the page/i)).toBeInTheDocument();
  });

  it('displays error message for section level', () => {
    render(<ErrorFallback error={null} level="section" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/we encountered an unexpected error in this section/i),
    ).toBeInTheDocument();
  });

  it('defaults to page level when level is not specified', () => {
    render(<ErrorFallback error={null} />);

    expect(screen.getByText(/please try refreshing the page/i)).toBeInTheDocument();
  });

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

  it('renders reset button when onReset is provided', () => {
    const onReset = vi.fn();
    render(<ErrorFallback error={null} onReset={onReset} />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
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

  it('applies page-level styling classes', () => {
    const { container } = render(<ErrorFallback error={null} level="page" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('min-h-screen');
  });

  it('applies section-level styling classes', () => {
    const { container } = render(<ErrorFallback error={null} level="section" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('min-h-[400px]');
    expect(wrapper).not.toHaveClass('min-h-screen');
  });

  it('includes AlertCircle icon with aria-hidden', () => {
    const { container } = render(<ErrorFallback error={null} />);

    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });
});
