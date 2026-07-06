import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineSuccess } from './InlineSuccess';

describe('InlineSuccess', () => {
  it('displays the success message', () => {
    render(<InlineSuccess message="Profile updated successfully" />);

    expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<InlineSuccess message="Test success" />);

    const successContainer = screen.getByRole('status');
    expect(successContainer).toBeInTheDocument();
  });

  it('displays different success messages correctly', () => {
    const { rerender } = render(<InlineSuccess message="First success" />);
    expect(screen.getByText('First success')).toBeInTheDocument();

    rerender(<InlineSuccess message="Second success" />);
    expect(screen.getByText('Second success')).toBeInTheDocument();
    expect(screen.queryByText('First success')).not.toBeInTheDocument();
  });
});
