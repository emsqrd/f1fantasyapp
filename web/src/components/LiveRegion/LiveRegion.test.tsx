import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveRegion } from './LiveRegion';

describe('LiveRegion', () => {
  it('announces messages with aria-live', () => {
    render(<LiveRegion message="Form submitted successfully" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveTextContent('Form submitted successfully');
  });

  it('does not render when message is empty', () => {
    const { container } = render(<LiveRegion message="" />);

    expect(container.firstChild).toBeNull();
  });

  it('uses polite politeness by default', () => {
    render(<LiveRegion message="Update complete" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('supports assertive politeness', () => {
    render(<LiveRegion message="Error occurred" politeness="assertive" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
  });

  it('has aria-atomic="true" attribute', () => {
    render(<LiveRegion message="Test message" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('is visually hidden with sr-only class', () => {
    render(<LiveRegion message="Test message" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveClass('sr-only');
  });

  it('updates when message changes', () => {
    const { rerender } = render(<LiveRegion message="First message" />);

    expect(screen.getByText('First message')).toBeInTheDocument();

    rerender(<LiveRegion message="Second message" />);

    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.queryByText('First message')).not.toBeInTheDocument();
  });

  it('removes region when message becomes empty', () => {
    const { rerender, container } = render(<LiveRegion message="Test message" />);

    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<LiveRegion message="" />);

    expect(container.firstChild).toBeNull();
  });
});
