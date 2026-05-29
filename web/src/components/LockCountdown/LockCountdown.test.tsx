import type { LockCountdown as LockCountdownState } from '@/hooks/useLockCountdown';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LockCountdown } from './LockCountdown';

const DEADLINE = new Date('2026-05-31T12:00:00Z');

function makeState(overrides: Partial<LockCountdownState> = {}): LockCountdownState {
  return {
    isLocked: false,
    lockingImminently: false,
    lockDeadline: DEADLINE,
    remaining: { days: 2, hours: 5, minutes: 9 },
    ...overrides,
  };
}

describe('LockCountdown', () => {
  it('renders nothing when there is no deadline', () => {
    const { container } = render(
      <LockCountdown state={makeState({ lockDeadline: null, remaining: null })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the locked state', () => {
    render(<LockCountdown state={makeState({ isLocked: true, remaining: null })} />);

    expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
    expect(screen.queryByText('Lineup locks in')).not.toBeInTheDocument();
  });

  it('renders the imminent state', () => {
    render(<LockCountdown state={makeState({ lockingImminently: true, remaining: null })} />);

    expect(screen.getByText('Less than 1 minute')).toBeInTheDocument();
  });

  it.each(['hero', 'compact'] as const)(
    'exposes an accessible countdown duration for the %s variant',
    (variant) => {
      render(<LockCountdown state={makeState()} variant={variant} />);

      expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
      expect(screen.getByText('2 days, 5 hours, 9 minutes')).toBeInTheDocument();
    },
  );
});
