import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InfoRoleCardContent, type InfoRoleCardContentProps } from './InfoRoleCardContent';

describe('InfoRoleCardContent', () => {
  const defaultProps: InfoRoleCardContentProps = {
    name: 'Lewis Hamilton',
  };

  const renderComponent = (props: Partial<InfoRoleCardContentProps> = {}) => {
    return render(<InfoRoleCardContent {...defaultProps} {...props} />);
  };

  it('should display the provided name', () => {
    renderComponent();

    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
  });

  it('should update when props change', () => {
    const { rerender } = render(<InfoRoleCardContent {...defaultProps} />);

    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();

    rerender(<InfoRoleCardContent name="Max Verstappen" />);

    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.queryByText('Lewis Hamilton')).not.toBeInTheDocument();
  });

  describe('edge cases', () => {
    it('should handle empty name', () => {
      renderComponent({ name: '' });

      // The empty name should still render, just be empty
      expect(screen.queryByText('Lewis Hamilton')).not.toBeInTheDocument();
    });
  });
});
