import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LockCountdown } from './LockCountdown';

describe('LockCountdown', () => {
  it('renders nothing for an open lineup with no deadline', () => {
    const { container } = render(
      <LockCountdown state={{ phase: 'open', remaining: null, lockingImminently: false }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the locked state', () => {
    render(<LockCountdown state={{ phase: 'locked' }} />);

    expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
    expect(screen.queryByText('Lineup locks in')).not.toBeInTheDocument();
  });

  it('renders the imminent state inside the final minute', () => {
    render(
      <LockCountdown
        state={{
          phase: 'open',
          remaining: { days: 0, hours: 0, minutes: 0 },
          lockingImminently: true,
        }}
      />,
    );

    expect(screen.getByText('Less than 1 minute')).toBeInTheDocument();
  });

  it.each(['hero', 'compact'] as const)(
    'exposes an accessible countdown duration for the %s variant',
    (variant) => {
      render(
        <LockCountdown
          state={{
            phase: 'open',
            remaining: { days: 2, hours: 5, minutes: 9 },
            lockingImminently: false,
          }}
          variant={variant}
        />,
      );

      expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
      expect(screen.getByText('2 days, 5 hours, 9 minutes')).toBeInTheDocument();
    },
  );

  it.each(['hero', 'compact'] as const)(
    'renders nothing for the %s variant while awaiting results',
    (variant) => {
      const { container } = render(
        <LockCountdown state={{ phase: 'awaitingResults' }} variant={variant} />,
      );

      expect(container).toBeEmptyDOMElement();
    },
  );
});
