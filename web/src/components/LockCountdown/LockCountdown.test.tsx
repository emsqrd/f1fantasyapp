import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LockCountdown } from './LockCountdown';

const NOW = new Date('2026-05-29T12:00:00Z');
const DEADLINE = '2026-05-31T17:09:00Z';

describe('LockCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there is no deadline', () => {
    const { container } = render(<LockCountdown phase="open" lockDeadline={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the locked state', () => {
    render(<LockCountdown phase="locked" lockDeadline="2026-05-29T11:00:00Z" />);

    expect(screen.getByText('Lineup Locked')).toBeInTheDocument();
    expect(screen.queryByText('Lineup locks in')).not.toBeInTheDocument();
  });

  it('renders the imminent state inside the final minute', () => {
    render(<LockCountdown phase="open" lockDeadline="2026-05-29T12:00:30Z" />);

    expect(screen.getByText('Less than 1 minute')).toBeInTheDocument();
  });

  it.each(['hero', 'compact'] as const)(
    'exposes an accessible countdown duration for the %s variant',
    (variant) => {
      render(<LockCountdown phase="open" lockDeadline={DEADLINE} variant={variant} />);

      expect(screen.getByText('Lineup locks in')).toBeInTheDocument();
      expect(screen.getByText('2 days, 5 hours, 9 minutes')).toBeInTheDocument();
    },
  );

  it.each(['hero', 'compact'] as const)(
    'renders nothing for the %s variant while awaiting results',
    (variant) => {
      const { container } = render(
        <LockCountdown phase="awaitingResults" lockDeadline={DEADLINE} variant={variant} />,
      );

      expect(container).toBeEmptyDOMElement();
    },
  );
});
