import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lineupPhase, useLineupPhase } from './useLineupPhase';

const DEADLINE = '2026-05-30T12:00:00Z';
const RACE_DATE = '2026-05-31T13:00:00Z';

const at = (iso: string) => Date.parse(iso);

describe('lineupPhase', () => {
  it('is open before the lock deadline', () => {
    expect(lineupPhase(DEADLINE, RACE_DATE, at('2026-05-30T11:59:59Z')).phase).toBe('open');
  });

  it('is locked at the lock deadline', () => {
    expect(lineupPhase(DEADLINE, RACE_DATE, at(DEADLINE))).toEqual({ phase: 'locked' });
  });

  it('is locked between the lock deadline and the race date', () => {
    expect(lineupPhase(DEADLINE, RACE_DATE, at('2026-05-31T12:00:00Z')).phase).toBe('locked');
  });

  it('is awaitingResults at the race date', () => {
    expect(lineupPhase(DEADLINE, RACE_DATE, at(RACE_DATE))).toEqual({
      phase: 'awaitingResults',
    });
  });

  it('is awaitingResults after the race date', () => {
    expect(lineupPhase(DEADLINE, RACE_DATE, at('2026-06-01T00:00:00Z')).phase).toBe(
      'awaitingResults',
    );
  });

  it('is locked past the deadline when there is no race date', () => {
    expect(lineupPhase(DEADLINE, null, at('2026-06-01T00:00:00Z'))).toEqual({
      phase: 'locked',
    });
  });

  it('is awaitingResults past the race date when there is no deadline', () => {
    expect(lineupPhase(null, RACE_DATE, at('2026-06-01T00:00:00Z')).phase).toBe('awaitingResults');
  });

  it('is open when there is no deadline and no race date', () => {
    expect(lineupPhase(null, null, at('2026-06-01T00:00:00Z'))).toEqual({
      phase: 'open',
      remaining: null,
      lockingImminently: false,
    });
  });

  describe('open-arm countdown', () => {
    const NOW = at('2026-05-24T12:00:00Z');
    const deadlineIn = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

    it('breaks remaining time into days, hours, and minutes for a multi-day deadline', () => {
      expect(lineupPhase(deadlineIn(3 * 24 * 60 + 5 * 60 + 12), null, NOW)).toEqual({
        phase: 'open',
        remaining: { days: 3, hours: 5, minutes: 12 },
        lockingImminently: false,
      });
    });

    it('reports zero days when the deadline is under 24 hours away', () => {
      expect(lineupPhase(deadlineIn(5 * 60 + 12), null, NOW)).toEqual({
        phase: 'open',
        remaining: { days: 0, hours: 5, minutes: 12 },
        lockingImminently: false,
      });
    });

    it('reports zero days and hours when the deadline is under an hour away', () => {
      expect(lineupPhase(deadlineIn(12), null, NOW)).toEqual({
        phase: 'open',
        remaining: { days: 0, hours: 0, minutes: 12 },
        lockingImminently: false,
      });
    });

    it('is imminent under a minute before the deadline', () => {
      expect(lineupPhase(new Date(NOW + 30_000).toISOString(), null, NOW)).toEqual({
        phase: 'open',
        remaining: { days: 0, hours: 0, minutes: 0 },
        lockingImminently: true,
      });
    });

    it('has no remaining countdown when there is no deadline', () => {
      expect(lineupPhase(null, null, NOW)).toEqual({
        phase: 'open',
        remaining: null,
        lockingImminently: false,
      });
    });
  });
});

describe('useLineupPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T11:59:30Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flips open → locked → awaitingResults as the clock passes each boundary', () => {
    const { result } = renderHook(() => useLineupPhase(DEADLINE, RACE_DATE));

    expect(result.current.phase).toBe('open');

    act(() => {
      vi.setSystemTime(new Date('2026-05-30T12:00:01Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe('locked');

    act(() => {
      vi.setSystemTime(new Date('2026-05-31T13:00:01Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe('awaitingResults');
  });
});
