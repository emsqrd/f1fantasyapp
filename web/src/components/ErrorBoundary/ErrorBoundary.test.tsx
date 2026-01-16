import * as Sentry from '@sentry/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches render errors and displays fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('captures exception with Sentry', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        contexts: expect.objectContaining({
          react: expect.objectContaining({
            componentStack: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('calls onReset callback when reset is triggered', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const resetButton = screen.getByRole('button', { name: /try again/i });
    await user.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('distinguishes between page and section level errors', () => {
    const { rerender } = render(
      <ErrorBoundary level="page">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Page level should have full-height styling on the outer div
    const pageElement = screen.getByText(/something went wrong/i).closest('.min-h-screen');
    expect(pageElement).toBeInTheDocument();

    rerender(
      <ErrorBoundary level="section">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Section level should have min-h-[400px] instead
    const sectionElement = screen.getByText(/something went wrong/i).closest('.min-h-\\[400px\\]');
    expect(sectionElement).toBeInTheDocument();
  });
});
