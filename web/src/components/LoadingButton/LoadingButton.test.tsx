import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoadingButton } from './LoadingButton';

describe('LoadingButton', () => {
  it('renders children when not loading', () => {
    render(<LoadingButton>Click me</LoadingButton>);

    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('sets aria-busy to true when loading', () => {
    render(<LoadingButton isLoading={true}>Click me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('sets aria-busy to false when not loading', () => {
    render(<LoadingButton isLoading={false}>Click me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it('displays loading text when loading', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('displays custom loading text when provided', () => {
    render(
      <LoadingButton isLoading={true} loadingText="Submitting...">
        Submit
      </LoadingButton>,
    );

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('displays spinner icon when loading', () => {
    const { container } = render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    const spinner = container.querySelector('svg[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('does not display spinner when not loading', () => {
    const { container } = render(<LoadingButton isLoading={false}>Submit</LoadingButton>);

    const spinner = container.querySelector('svg[aria-hidden="true"]');
    expect(spinner).not.toBeInTheDocument();
  });

  it('remains focusable when loading', async () => {
    const user = userEvent.setup();
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    await user.tab();

    expect(button).toHaveFocus();
  });

  it('is clickable when loading (does not use disabled attribute)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <LoadingButton isLoading={true} onClick={onClick}>
        Submit
      </LoadingButton>,
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes through button props correctly', () => {
    render(
      <LoadingButton variant="destructive" size="lg" className="custom-class">
        Delete
      </LoadingButton>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('toggles between loading and normal state', () => {
    const { rerender } = render(<LoadingButton isLoading={false}>Submit</LoadingButton>);

    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    rerender(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });
});
