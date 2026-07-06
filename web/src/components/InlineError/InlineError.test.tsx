import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineError } from './InlineError';

describe('InlineError', () => {
  it('displays the error message', () => {
    render(<InlineError message="Invalid email address" />);

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<InlineError message="Test error" />);

    const errorContainer = screen.getByRole('alert');
    expect(errorContainer).toBeInTheDocument();
  });

  it('displays different error messages correctly', () => {
    const { rerender } = render(<InlineError message="First error" />);
    expect(screen.getByText('First error')).toBeInTheDocument();

    rerender(<InlineError message="Second error" />);
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });
});
